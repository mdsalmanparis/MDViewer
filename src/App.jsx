import { useState, useCallback, useEffect } from 'react';
import RepoForm from './components/RepoForm';
import FileTree from './components/FileTree';
import MarkdownView from './components/MarkdownView';
import Notebooks from './components/Notebooks';
import Breadcrumbs from './components/Breadcrumbs';
import { useNotebooks } from './hooks/useNotebooks';
import { fetchTree, fetchFile, fetchSnapshot } from './github';
import { registerRepoForSnapshot, saveWriteToken } from './autoSnapshot';
import './App.css';

function IconRefresh() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  );
}
function IconMenu() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
}
function IconClose() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}
function IconSun() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;
}
function IconMoon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
}
function IconStars() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}

const THEMES = ['dark', 'light', 'midnight'];
const THEME_META = {
  dark:     { icon: <IconSun />,   label: 'Light',    next: 'light' },
  light:    { icon: <IconMoon />,  label: 'Midnight', next: 'midnight' },
  midnight: { icon: <IconStars />, label: 'Dark',     next: 'dark' },
};

function ThemeToggle({ theme, onToggle, iconOnly }) {
  const meta = THEME_META[theme] ?? THEME_META.dark;
  return (
    <button className={`theme-toggle theme-toggle--${theme} ${iconOnly ? 'icon-only' : ''}`} onClick={onToggle} title={`Switch to ${meta.label}`}>
      {meta.icon}
      {!iconOnly && <span>{meta.label}</span>}
    </button>
  );
}

export default function App() {
  const [theme, setTheme]               = useState('dark');
  const [repo, setRepo]                 = useState(null);
  const [paths, setPaths]               = useState([]);
  const [loadingRepo, setLoadingRepo]   = useState(false);
  const [repoError, setRepoError]       = useState('');

  const [selectedPath, setSelectedPath] = useState(null);
  const [fileContent, setFileContent]   = useState('');
  const [loadingFile, setLoadingFile]   = useState(false);
  const [fileError, setFileError]       = useState('');

  const [search, setSearch]             = useState('');
  const [sidebarOpen, setSidebarOpen]   = useState(true);
  const [refreshing, setRefreshing]     = useState(false);

  const { notebooks, save: saveNotebook, remove: removeNotebook } = useNotebooks();

  const THEME_COLOR = { dark: '#212119', light: '#ffffff', midnight: '#1a1726' };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    // Update PWA status bar / browser chrome color to match active theme
    let tag = document.querySelector('meta[name="theme-color"]');
    if (!tag) { tag = document.createElement('meta'); tag.name = 'theme-color'; document.head.appendChild(tag); }
    tag.content = THEME_COLOR[theme] ?? THEME_COLOR.dark;
  }, [theme]);

  function closeSidebarOnMobile() {
    if (window.innerWidth < 768) setSidebarOpen(false);
  }

  async function loadRepo(owner, repoName, token, cachedPaths) {
    setLoadingRepo(true);
    setRepoError('');
    setPaths([]);
    setSelectedPath(null);
    setFileContent('');
    setSearch('');
    try {
      let filePaths, snapshot = null;

      if (cachedPaths) {
        filePaths = cachedPaths;
      } else {
        try {
          filePaths = await fetchTree(owner, repoName, token);
        } catch {
          // GitHub blocked — try bundled snapshot
          snapshot = await fetchSnapshot(owner, repoName);
          if (!snapshot) throw new Error('GitHub is unreachable and no offline snapshot found for this repo.');
          filePaths = snapshot.paths;
        }
      }

      if (filePaths.length === 0) {
        setRepoError('No supported files found in this repository.');
        setRepo(null);
      } else {
        setRepo({ owner, repo: repoName, token, snapshot });
        setPaths(filePaths);
        if (token) saveWriteToken(token);
        if (!snapshot) registerRepoForSnapshot(owner, repoName, token);
        saveNotebook(owner, repoName, filePaths, token);
        if (window.innerWidth < 768) setSidebarOpen(true);
      }
    } catch (e) {
      setRepoError(e.message);
      setRepo(null);
    } finally {
      setLoadingRepo(false);
    }
  }

  async function refreshRepo() {
    if (!repo || refreshing || repo.snapshot) return;
    setRefreshing(true);
    try {
      const filePaths = await fetchTree(repo.owner, repo.repo, repo.token);
      if (filePaths.length > 0) {
        setPaths(filePaths);
        saveNotebook(repo.owner, repo.repo, filePaths);
      }
    } catch (e) {
      // silently ignore — keep existing paths
    } finally {
      setRefreshing(false);
    }
  }

  const handleSelectFile = useCallback(async (path) => {
    if (!repo) return;
    setSelectedPath(path);
    setLoadingFile(true);
    setFileError('');
    setFileContent('');
    closeSidebarOnMobile();
    try {
      let content;
      if (repo.snapshot) {
        content = repo.snapshot.files[path] ?? '';
      } else {
        try {
          content = await fetchFile(repo.owner, repo.repo, path, repo.token);
        } catch {
          // fetchFile failed (rate limit, blocked, missing token) — try snapshot
          const snap = repo._snap ?? await fetchSnapshot(repo.owner, repo.repo);
          if (snap?.files[path] !== undefined) {
            content = snap.files[path];
            setRepo(r => ({ ...r, snapshot: snap, _snap: snap }));
          } else {
            throw new Error('Failed to load file. GitHub is unreachable and no offline snapshot found.');
          }
        }
      }
      setFileContent(content);
    } catch (e) {
      setFileError(e.message);
    } finally {
      setLoadingFile(false);
    }
  }, [repo]);

  function handleFolderClick(prefix) { setSearch(prefix); }

  const filteredPaths = search.trim()
    ? paths.filter(p => p.toLowerCase().startsWith(search.toLowerCase()) || p.toLowerCase().includes(search.toLowerCase()))
    : paths;

  /* ── Home ── */
  if (!repo && !loadingRepo) {
    return (
      <>
        <ThemeToggle theme={theme} onToggle={() => setTheme(t => THEME_META[t]?.next ?? 'light')} />
        {repoError && <div className="global-error">⚠ {repoError}</div>}
        <div className="home-wrap">
          <RepoForm onSubmit={({ owner, repo: r, token }) => loadRepo(owner, r, token, null)} loading={false} />
          <Notebooks notebooks={notebooks} onOpen={n => loadRepo(n.owner, n.repo, n.token ?? null, n.paths)} onRemove={removeNotebook} />
        </div>
      </>
    );
  }

  /* ── Loading ── */
  if (loadingRepo) {
    return (
      <div className="fullscreen-loader">
        <ThemeToggle theme={theme} onToggle={() => setTheme(t => THEME_META[t]?.next ?? 'light')} />
        <div className="spinner large" />
        <p>Fetching markdown files…</p>
      </div>
    );
  }

  /* ── Reader ── */
  const breadcrumbs = (
    <Breadcrumbs repo={repo} selectedPath={selectedPath} onFolderClick={handleFolderClick} />
  );

  return (
    <div className="app-shell">
      {/* Mobile top bar */}
      <header className="mobile-bar">
        <button className="mobile-menu-btn" onClick={() => setSidebarOpen(v => !v)}>
          {sidebarOpen ? <IconClose /> : <IconMenu />}
        </button>
        <div className="mobile-title">
          {selectedPath
            ? <span className="mobile-file">{selectedPath.split('/').pop()}</span>
            : <span>{repo.owner}/{repo.repo}</span>}
        </div>
        <ThemeToggle theme={theme} onToggle={() => setTheme(t => THEME_META[t]?.next ?? 'light')} iconOnly />
      </header>

      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-header-top">
            <button className="back-btn" onClick={() => { setRepo(null); setPaths([]); }}>← Back</button>
            <button
              className={`refresh-btn ${refreshing ? 'spinning' : ''}`}
              onClick={refreshRepo}
              disabled={refreshing}
              title="Re-fetch files from GitHub"
            >
              <IconRefresh />
            </button>
          </div>
          <div className="repo-badge">
            <span className="dot" />
            <span>{repo.owner}/{repo.repo}</span>
            {repo.snapshot && (
              <span className="snapshot-badge" title={`Offline snapshot — fetched ${new Date(repo.snapshot.fetchedAt).toLocaleDateString()}`}>
                offline
              </span>
            )}
          </div>
        </div>
        <div className="sidebar-search">
          <input
            type="text"
            placeholder="Filter files…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className="search-clear" onClick={() => setSearch('')}>×</button>}
        </div>
        <div className="sidebar-count">{filteredPaths.length} file{filteredPaths.length !== 1 ? 's' : ''}</div>
        <div className="sidebar-scroll">
          <FileTree paths={filteredPaths} onSelect={handleSelectFile} selected={selectedPath} />
        </div>
      </aside>

      <button className="sidebar-toggle desktop-only" onClick={() => setSidebarOpen(v => !v)}>
        {sidebarOpen ? '‹' : '›'}
      </button>

      <main className="content-area">
        <MarkdownView
          content={fileContent}
          path={selectedPath}
          loading={loadingFile}
          error={fileError}
          breadcrumbs={breadcrumbs}
        />
      </main>
    </div>
  );
}
