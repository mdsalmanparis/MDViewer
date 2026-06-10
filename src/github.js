import { CODE_EXTS, getExt } from './fileTypes.js';

const BASE = 'https://api.github.com';

function headers(token) {
  const h = { Accept: 'application/vnd.github+json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export async function fetchTree(owner, repo, token) {
  const branchRes = await fetch(`${BASE}/repos/${owner}/${repo}`, { headers: headers(token) });
  if (!branchRes.ok) throw new Error(`Repo not found or access denied (${branchRes.status})`);
  const { default_branch } = await branchRes.json();

  const treeRes = await fetch(
    `${BASE}/repos/${owner}/${repo}/git/trees/${default_branch}?recursive=1`,
    { headers: headers(token) }
  );
  if (!treeRes.ok) throw new Error(`Failed to fetch tree (${treeRes.status})`);
  const { tree } = await treeRes.json();

  return tree
    .filter(item => item.type === 'blob' && CODE_EXTS.has(getExt(item.path)))
    .map(item => item.path);
}

export async function fetchFile(owner, repo, path, token) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const res = await fetch(
    `${BASE}/repos/${owner}/${repo}/contents/${encodedPath}`,
    { headers: headers(token) }
  );
  if (!res.ok) throw new Error(`Failed to fetch file (${res.status})`);
  const data = await res.json();
  const binary = atob(data.content.replace(/\n/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

// Loads a pre-built offline snapshot from /snapshots/<owner>__<repo>.json
// Returns null if not found (no snapshot generated yet).
export async function fetchSnapshot(owner, repo) {
  const url = `${import.meta.env.BASE_URL}snapshots/${owner}__${repo}.json`.replace('//', '/');
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
