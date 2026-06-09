export default function Breadcrumbs({ repo, selectedPath, onFolderClick }) {
  const segments = selectedPath ? selectedPath.split('/') : [];

  return (
    <nav className="breadcrumbs">
      <button className="bc-seg bc-root" onClick={() => onFolderClick('')}>
        ✦ {repo.repo}
      </button>
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        const prefix = segments.slice(0, i + 1).join('/');
        return (
          <span key={i} className="bc-item">
            <span className="bc-sep">›</span>
            {isLast ? (
              <span className="bc-seg bc-file">{seg}</span>
            ) : (
              <button className="bc-seg bc-folder" onClick={() => onFolderClick(prefix + '/')}>
                {seg}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
