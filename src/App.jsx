import { useState, useCallback, useEffect, useMemo } from 'react';
import RepoForm from './components/RepoForm';
import FileTree from './components/FileTree';
import MarkdownView from './components/MarkdownView';
import Notebooks from './components/Notebooks';
import Breadcrumbs from './components/Breadcrumbs';
import AnalyticsCard from './components/AnalyticsCard';
import { useNotebooks } from './hooks/useNotebooks';
import { useProgress } from './hooks/useProgress';
import {
  fetchTree, fetchFile, fetchSnapshot,
  saveLocalCachePaths, saveLocalCacheFile, loadLocalCache,
} from './github';
import {
  saveFileToCache, fetchFileFromCache,
} from './supabase';
import { registerRepoForSnapshot, saveWriteToken } from './autoSnapshot';
import { isMarkdown } from './fileTypes';
import './App.css';

/* ── Icons ── */
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
function IconNotion() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <line x1="8" y1="8" x2="16" y2="8"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
      <line x1="8" y1="16" x2="12" y2="16"/>
    </svg>
  );
}

/* ── Themes ── */
const THEMES = ['dark', 'light', 'midnight', 'notion'];
const THEME_META = {
  dark:     { icon: <IconSun />,    label: 'Light',    next: 'light' },
  light:    { icon: <IconMoon />,   label: 'Midnight', next: 'midnight' },
  midnight: { icon: <IconNotion />, label: 'Notion',   next: 'notion' },
  notion:   { icon: <IconStars />,  label: 'Dark',     next: 'dark' },
};
const THEME_COLOR = { dark: '#212119', light: '#ffffff', midnight: '#1a1726', notion: '#f7f6f3' };

function ThemeToggle({ theme, onToggle, iconOnly }) {
  const meta = THEME_META[theme] ?? THEME_META.dark;
  return (
    <button
      className={`theme-toggle theme-toggle--${theme} ${iconOnly ? 'icon-only' : ''}`}
      onClick={onToggle}
      title={`Switch to ${meta.label}`}
    >
      {meta.icon}
      {!iconOnly && <span>{meta.label}</span>}
    </button>
  );
}

/* ── Slugify (matches rehype-slug) ── */
function slugify(text) {
  return text.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/* ── Scroll to heading in article ── */
function scrollToHeading(id) {
  const article = document.querySelector('.md-article');
  const el = article?.querySelector(`#${CSS.escape(id)}`);
  if (!el || !article) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); return; }
  const offset = el.getBoundingClientRect().top - article.getBoundingClientRect().top;
  article.scrollBy({ top: offset - 20, behavior: 'smooth' });
}

/* ── Module Progress panel in sidebar ── */
function ModuleProgress({ paths, readFilesSet, onSelectModule, totalRead }) {
  const [open, setOpen] = useState(false);

  const modules = useMemo(() => {
    const map = {};
    for (const p of paths) {
      const top = p.includes('/') ? p.split('/')[0] : '__root__';
      if (!map[top]) map[top] = { total: 0, read: 0 };
      map[top].total++;
      if (readFilesSet.has(p)) map[top].read++;
    }
    return Object.entries(map)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.read / b.total - a.read / a.total || a.name.localeCompare(b.name));
  }, [paths, readFilesSet]);

  if (!paths.length || totalRead === 0) return null;

  return (
    <div className="module-progress">
      <button className="module-progress-toggle" onClick={() => setOpen(v => !v)}>
        <span>Progress</span>
        <span className="module-progress-count">{totalRead}/{paths.length}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className="module-list">
          {modules.map(m => (
            <div
              key={m.name}
              className="module-item"
              onClick={() => onSelectModule(m.name === '__root__' ? '' : m.name)}
            >
              <span className="module-name">{m.name === '__root__' ? '/ root' : m.name}</span>
              <div className="module-bar">
                <div className="module-bar-fill" style={{ width: `${(m.read / m.total) * 100}%` }} />
              </div>
              <span className="module-count">{m.read}/{m.total}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Outline panel with sub-concept ticks ── */
function OutlinePanel({ content, path, headingChecks, onToggleHeading }) {
  const headings = useMemo(() => {
    if (!content || !isMarkdown(path || '')) return [];
    const matches = [...content.matchAll(/^(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/gm)];
    return matches.map(([, hashes, text]) => ({
      level: hashes.length,
      text:  text.trim(),
      id:    slugify(text.trim()),
    }));
  }, [content, path]);

  if (!headings.length) {
    return (
      <div className="outline-empty">
        <p>No headings found</p>
        <span>Select a markdown file</span>
      </div>
    );
  }

  const fileChecks = (path && headingChecks[path]) ? new Set(headingChecks[path]) : new Set();
  // Count checkable headings (h2/h3 = sub-concepts)
  const conceptHeadings = headings.filter(h => h.level >= 2 && h.level <= 3);
  const doneConcepts    = conceptHeadings.filter(h => fileChecks.has(h.id)).length;
  const totalConcepts   = conceptHeadings.length;

  return (
    <div className="outline-wrap">
      {totalConcepts > 0 && (
        <div className="outline-progress">
          <div className="outline-progress-bar">
            <div
              className="outline-progress-fill"
              style={{ width: `${totalConcepts > 0 ? (doneConcepts / totalConcepts) * 100 : 0}%` }}
            />
          </div>
          <span className="outline-progress-label">
            {doneConcepts}/{totalConcepts} concepts done
          </span>
        </div>
      )}
      <nav className="outline-nav">
        {headings.map((h, i) => {
          const isCheckable = h.level >= 2 && h.level <= 3;
          const isDone      = fileChecks.has(h.id);
          return (
            <div key={i} className={`outline-row ${isDone ? 'outline-done' : ''}`}>
              {isCheckable && (
                <button
                  className={`concept-tick ${isDone ? 'checked' : ''}`}
                  onClick={(e) => { e.stopPropagation(); onToggleHeading?.(path, h.id); }}
                  title={isDone ? 'Mark as not done' : 'Mark as done'}
                >
                  {isDone ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : null}
                </button>
              )}
              <button
                className={`outline-item outline-h${h.level} ${!isCheckable ? 'outline-no-tick' : ''}`}
                style={{ paddingLeft: `${(h.level - 1) * 10 + (isCheckable ? 4 : 14)}px` }}
                onClick={() => scrollToHeading(h.id)}
                title={h.text}
              >
                {h.text}
              </button>
            </div>
          );
        })}
      </nav>
    </div>
  );
}

/* ── App ── */
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
  const [sidebarTab, setSidebarTab]     = useState('files');

  const { notebooks, save: saveNotebook, remove: removeNotebook } = useNotebooks();

  const {
    readFilesSet, streak, markRead, recordActivity,
    saveScrollPos, toggleHeading, scrollPositions, headingChecks, totalRead,
  } = useProgress(repo?.owner ?? null, repo?.repo ?? null);

  const savedScrollPct = readFilesSet.has(selectedPath)
    ? 0
    : (scrollPositions[selectedPath] ?? 0);

  // Theme persistence
  useEffect(() => {
    const saved = localStorage.getItem('mdview-theme');
    if (THEMES.includes(saved)) setTheme(saved);
  }, []);
  useEffect(() => { localStorage.setItem('mdview-theme', theme); }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
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
    setSidebarTab('files');
    try {
      let filePaths, snapshot = null;

      if (cachedPaths) {
        filePaths = cachedPaths;
      } else {
        try {
          filePaths = await fetchTree(owner, repoName, token);
          saveLocalCachePaths(owner, repoName, filePaths);
        } catch {
          snapshot = await fetchSnapshot(owner, repoName);
          if (!snapshot) {
            const local = loadLocalCache(owner, repoName);
            if (local?.paths?.length) {
              filePaths = local.paths;
              snapshot = { ...local, fetchedAt: local.updatedAt, _local: true };
            } else {
              throw new Error('GitHub is unreachable and no offline snapshot found for this repo.');
            }
          } else {
            filePaths = snapshot.paths;
          }
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
        saveLocalCachePaths(repo.owner, repo.repo, filePaths);
      }
    } catch { /* silent */ } finally { setRefreshing(false); }
  }

  const repoId = repo ? `${repo.owner}__${repo.repo}` : null;

  const handleSelectFile = useCallback(async (path) => {
    if (!repo) return;
    setSelectedPath(path);
    setLoadingFile(true);
    setFileError('');
    setFileContent('');
    closeSidebarOnMobile();
    recordActivity();
    try {
      let content;
      if (repo.snapshot) {
        content = repo.snapshot.files?.[path] ?? '';
        if (!content && repo.snapshot._local) {
          const local = loadLocalCache(repo.owner, repo.repo);
          content = local?.files?.[path] ?? '';
        }
      } else {
        try {
          content = await fetchFile(repo.owner, repo.repo, path, repo.token);
          // Cache immediately so blocked machines get the latest version
          saveLocalCacheFile(repo.owner, repo.repo, path, content);
          saveFileToCache(`${repo.owner}__${repo.repo}`, path, content);
        } catch {
          // Fallback chain: server snapshot → Supabase cache → local browser cache
          const snap = repo._snap ?? await fetchSnapshot(repo.owner, repo.repo);
          if (snap?.files?.[path] !== undefined) {
            content = snap.files[path];
            setRepo(r => ({ ...r, snapshot: snap, _snap: snap }));
          } else {
            const supaContent = await fetchFileFromCache(repoId, path);
            if (supaContent !== null) {
              content = supaContent;
            } else {
              const local = loadLocalCache(repo.owner, repo.repo);
              if (local?.files?.[path] !== undefined) {
                content = local.files[path];
              } else {
                throw new Error('Failed to load file. GitHub is unreachable and no offline snapshot found.');
              }
            }
          }
        }
      }
      setFileContent(content);
    } catch (e) {
      setFileError(e.message);
    } finally {
      setLoadingFile(false);
    }
  }, [repo, repoId, recordActivity]);

  function handleFolderClick(prefix) { setSearch(prefix); }

  const filteredPaths = search.trim()
    ? paths.filter(p =>
        p.toLowerCase().startsWith(search.toLowerCase()) ||
        p.toLowerCase().includes(search.toLowerCase()))
    : paths;

  /* ── Home ── */
  if (!repo && !loadingRepo) {
    return (
      <>
        <ThemeToggle theme={theme} onToggle={() => setTheme(t => THEME_META[t]?.next ?? 'light')} />
        {repoError && <div className="global-error">⚠ {repoError}</div>}
        <div className="home-wrap">
          <RepoForm onSubmit={({ owner, repo: r, token }) => loadRepo(owner, r, token, null)} loading={false} />
          <AnalyticsCard onOpen={n => loadRepo(n.owner, n.repo, n.token ?? null, n.paths)} />
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
  const snapshotLabel = repo.snapshot
    ? (repo.snapshot._local ? 'local cache' : 'offline')
    : null;

  return (
    <div className="app-shell">
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
            <div className="sidebar-header-right">
              {streak > 0 && (
                <span className="streak-badge" title={`${streak} day reading streak`}>🔥 {streak}</span>
              )}
              <button
                className={`refresh-btn ${refreshing ? 'spinning' : ''}`}
                onClick={refreshRepo}
                disabled={refreshing || !!repo.snapshot}
                title={repo.snapshot ? 'Offline — refresh unavailable' : 'Re-fetch files from GitHub'}
              >
                <IconRefresh />
              </button>
            </div>
          </div>
          <div className="repo-badge">
            <span className="dot" />
            <span>{repo.owner}/{repo.repo}</span>
            {snapshotLabel && (
              <span className="snapshot-badge" title={snapshotLabel === 'offline' ? 'Offline snapshot' : 'Local browser cache'}>
                {snapshotLabel}
              </span>
            )}
          </div>
        </div>

        <div className="sidebar-tabs">
          <button
            className={`sidebar-tab ${sidebarTab === 'files' ? 'active' : ''}`}
            onClick={() => setSidebarTab('files')}
          >Files</button>
          <button
            className={`sidebar-tab ${sidebarTab === 'outline' ? 'active' : ''}`}
            onClick={() => setSidebarTab('outline')}
          >Outline</button>
        </div>

        {sidebarTab === 'files' && (
          <>
            <div className="sidebar-search">
              <input
                type="text"
                placeholder="Filter files…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && <button className="search-clear" onClick={() => setSearch('')}>×</button>}
            </div>
            <div className="sidebar-count">
              {filteredPaths.length} file{filteredPaths.length !== 1 ? 's' : ''}
            </div>
            <ModuleProgress
              paths={paths}
              readFilesSet={readFilesSet}
              onSelectModule={handleFolderClick}
              totalRead={totalRead}
            />
            <div className="sidebar-scroll">
              <FileTree
                paths={filteredPaths}
                onSelect={handleSelectFile}
                selected={selectedPath}
                readFiles={readFilesSet}
              />
            </div>
          </>
        )}

        {sidebarTab === 'outline' && (
          <div className="sidebar-scroll">
            <OutlinePanel
              content={fileContent}
              path={selectedPath}
              headingChecks={headingChecks}
              onToggleHeading={toggleHeading}
            />
          </div>
        )}
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
          breadcrumbs={<Breadcrumbs repo={repo} selectedPath={selectedPath} onFolderClick={handleFolderClick} />}
          onMarkRead={markRead}
          onScrollChange={saveScrollPos}
          savedScrollPct={savedScrollPct}
        />
      </main>
    </div>
  );
}
