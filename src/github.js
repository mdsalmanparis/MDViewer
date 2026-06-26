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

// ── Local browser cache ──
// Saves fetched data to localStorage so the same device can work offline
// even before a CI-generated snapshot is available.
const LC_PREFIX = 'mdview-local-cache-';

function lcKey(owner, repo) {
  return `${LC_PREFIX}${owner}__${repo}`;
}

export function saveLocalCachePaths(owner, repo, paths) {
  try {
    const key = lcKey(owner, repo);
    const cur = JSON.parse(localStorage.getItem(key) || '{}');
    localStorage.setItem(key, JSON.stringify({ ...cur, paths, updatedAt: new Date().toISOString() }));
  } catch {}
}

export function saveLocalCacheFile(owner, repo, path, content) {
  if (content.length > 120000) return; // skip very large files to protect quota
  try {
    const key = lcKey(owner, repo);
    const cur = JSON.parse(localStorage.getItem(key) || '{}');
    const files = { ...(cur.files || {}), [path]: content };
    localStorage.setItem(key, JSON.stringify({ ...cur, files }));
  } catch {}
}

export function loadLocalCache(owner, repo) {
  try {
    const data = JSON.parse(localStorage.getItem(lcKey(owner, repo)));
    return data && (data.paths || data.files) ? data : null;
  } catch { return null; }
}
