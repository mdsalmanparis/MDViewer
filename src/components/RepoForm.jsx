import { useState } from 'react';

function parseRepoInput(input) {
  input = input.trim();
  const urlMatch = input.match(/github\.com\/([^/]+)\/([^/\s]+)/);
  if (urlMatch) return { owner: urlMatch[1], repo: urlMatch[2].replace(/\.git$/, '') };
  const slugMatch = input.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (slugMatch) return { owner: slugMatch[1], repo: slugMatch[2] };
  return null;
}

export default function RepoForm({ onSubmit, loading }) {
  const [input, setInput] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const parsed = parseRepoInput(input);
    if (!parsed) {
      setError('Enter a GitHub URL or owner/repo (e.g. facebook/react)');
      return;
    }
    setError('');
    onSubmit({ ...parsed, token: token.trim() || null });
  }

  return (
    <div className="repo-form-card">
        <div className="repo-form-logo">
          <div className="logo-icon">✦</div>
          <span>MDview</span>
        </div>
        <p className="repo-form-subtitle">Browse markdown files from any GitHub repository</p>
        <form onSubmit={handleSubmit}>
          <label className="field-label">Repository</label>
          <input
            className="field-input"
            type="text"
            placeholder="owner/repo or full GitHub URL"
            value={input}
            onChange={e => setInput(e.target.value)}
            autoFocus
          />
          <div className="token-row">
            <label className="field-label">
              Personal Access Token{' '}
              <span className="optional">(optional — for private repos)</span>
            </label>
            <button
              type="button"
              className="toggle-token"
              onClick={() => setShowToken(v => !v)}
            >
              {showToken ? 'Hide' : 'Show'}
            </button>
          </div>
          <input
            className="field-input"
            type={showToken ? 'text' : 'password'}
            placeholder="ghp_..."
            value={token}
            onChange={e => setToken(e.target.value)}
          />
          {error && <p className="form-error">{error}</p>}
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Loading…' : 'Browse →'}
          </button>
        </form>
    </div>
  );
}
