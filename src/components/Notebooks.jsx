function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return 'just now';
}

export default function Notebooks({ notebooks, onOpen, onRemove }) {
  if (!notebooks.length) return null;
  return (
    <div className="notebooks">
      <div className="notebooks-label">Recent</div>
      <div className="notebooks-grid">
        {notebooks.map(n => (
          <div key={n.id} className="notebook-card" onClick={() => onOpen(n)}>
            <button
              className="notebook-remove"
              onClick={e => { e.stopPropagation(); onRemove(n.id); }}
              title="Remove"
            >×</button>
            <div className="notebook-icon">✦</div>
            <div className="notebook-name">{n.owner}<span>/</span>{n.repo}</div>
            <div className="notebook-meta">{n.fileCount} files · {timeAgo(n.lastVisited)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
