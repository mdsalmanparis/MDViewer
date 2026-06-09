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
    .filter(item => item.type === 'blob' && item.path.toLowerCase().endsWith('.md'))
    .map(item => item.path);
}

export async function fetchFile(owner, repo, path, token) {
  const res = await fetch(
    `${BASE}/repos/${owner}/${repo}/contents/${path}`,
    { headers: headers(token) }
  );
  if (!res.ok) throw new Error(`Failed to fetch file (${res.status})`);
  const data = await res.json();
  const binary = atob(data.content.replace(/\n/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const content = new TextDecoder('utf-8').decode(bytes);
  return { content, sha: data.sha };
}

export async function pushFile({ owner, repo, path, content, sha, token, message }) {
  if (!token) throw new Error('A Personal Access Token is required to push changes.');
  const encoded = btoa(unescape(encodeURIComponent(content)));
  const body = { message, content: encoded };
  if (sha) body.sha = sha;

  const res = await fetch(
    `${BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
    {
      method: 'PUT',
      headers: { ...headers(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Push failed (${res.status})`);
  }
  return res.json();
}
