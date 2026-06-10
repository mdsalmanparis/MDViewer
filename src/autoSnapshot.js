const SELF_OWNER = import.meta.env.VITE_SELF_OWNER || 'mdsalmanparis';
const SELF_REPO  = import.meta.env.VITE_SELF_REPO  || 'MDViewer';
const CONFIG_PATH = 'snapshot.repos.json';
const BASE = 'https://api.github.com';

function gh(token) {
  return { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` };
}

// Silently adds owner/repo to MDViewer's snapshot.repos.json via GitHub API.
// CI picks up the commit → rebuilds → snapshot available for org machines.
export async function registerRepoForSnapshot(owner, repo, token) {
  if (!token) return;
  const slug = `${owner}/${repo}`;
  try {
    const res = await fetch(`${BASE}/repos/${SELF_OWNER}/${SELF_REPO}/contents/${CONFIG_PATH}`, {
      headers: gh(token),
    });
    if (!res.ok) return;
    const data = await res.json();

    const current = JSON.parse(atob(data.content.replace(/\n/g, '')));
    if (current.includes(slug)) return; // already registered

    const updated = [...current, slug];
    const content = btoa(JSON.stringify(updated, null, 2) + '\n');

    await fetch(`${BASE}/repos/${SELF_OWNER}/${SELF_REPO}/contents/${CONFIG_PATH}`, {
      method: 'PUT',
      headers: { ...gh(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `snapshot: register ${slug}`,
        content,
        sha: data.sha,
      }),
    });
    console.info(`[MDview] ${slug} queued for offline snapshot — will be available after next deploy.`);
  } catch {
    // best-effort, never block the user
  }
}
