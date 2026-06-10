/**
 * Pre-fetch GitHub repos into static snapshots for offline use.
 *
 * Usage:
 *   node scripts/fetch-snapshot.mjs                  ← fetches all repos in snapshot.repos.json
 *   node scripts/fetch-snapshot.mjs owner/repo       ← fetches one specific repo
 *
 * Token: set SNAPSHOT_TOKEN env var (GitHub PAT), or pass as second arg.
 * Public repos work without a token.
 *
 * Output: public/snapshots/<owner>__<repo>.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dir, '..');
const OUT_DIR = path.join(ROOT, 'public', 'snapshots');
const CONFIG = path.join(ROOT, 'snapshot.repos.json');

const CODE_EXTS = new Set([
  'md','mdx','py','pyw','js','mjs','cjs','jsx','ts','tsx',
  'java','kt','kts','scala','groovy','c','h','cpp','cc','cxx','hpp','cs',
  'go','rs','rb','php','swift','dart','sh','bash','zsh','fish','ps1','bat',
  'html','htm','css','scss','sass','less','json','yaml','yml','toml','xml',
  'ini','env','sql','r','lua','vim','txt','rst',
]);

function ext(p) { const parts = p.split('.'); return parts.length > 1 ? parts.pop().toLowerCase() : ''; }

async function ghFetch(url, token) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${url}`);
  return res.json();
}

async function fetchRepo(repoSlug, token) {
  const [owner, repo] = repoSlug.split('/');
  if (!owner || !repo) throw new Error(`Invalid repo slug: ${repoSlug}`);

  console.log(`\n→ ${owner}/${repo}`);
  const { default_branch } = await ghFetch(`https://api.github.com/repos/${owner}/${repo}`, token);
  const { tree } = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${default_branch}?recursive=1`, token
  );

  const blobs = tree.filter(i => i.type === 'blob' && CODE_EXTS.has(ext(i.path)));
  console.log(`  ${blobs.length} files found. Downloading…`);

  const files = {};
  const CHUNK = 10;
  for (let i = 0; i < blobs.length; i += CHUNK) {
    await Promise.all(blobs.slice(i, i + CHUNK).map(async item => {
      const data = await ghFetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${item.path.split('/').map(encodeURIComponent).join('/')}`,
        token
      );
      files[item.path] = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8');
    }));
    process.stdout.write(`\r  ${Math.min(i + CHUNK, blobs.length)}/${blobs.length}`);
  }
  process.stdout.write('\n');

  const snapshot = {
    owner,
    repo,
    fetchedAt: new Date().toISOString(),
    paths: blobs.map(b => b.path),
    files,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, `${owner}__${repo}.json`);
  fs.writeFileSync(outFile, JSON.stringify(snapshot));
  const kb = (fs.statSync(outFile).size / 1024).toFixed(0);
  console.log(`  ✓ saved public/snapshots/${owner}__${repo}.json (${kb} KB)`);
}

async function main() {
  const token = process.argv[3] || process.env.SNAPSHOT_TOKEN || '';

  let repos;
  if (process.argv[2]) {
    repos = [process.argv[2]];
  } else {
    if (!fs.existsSync(CONFIG)) {
      console.error('No snapshot.repos.json found. Add repos to it or pass owner/repo as argument.');
      process.exit(1);
    }
    repos = JSON.parse(fs.readFileSync(CONFIG, 'utf-8'));
    console.log(`Fetching ${repos.length} repo(s) from snapshot.repos.json…`);
  }

  for (const repo of repos) {
    await fetchRepo(repo.trim(), token);
  }
  console.log('\nAll done. Commit public/snapshots/ and redeploy.');
}

main().catch(e => { console.error(e.message); process.exit(1); });
