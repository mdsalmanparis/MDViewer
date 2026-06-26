import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import hljs from 'highlight.js/lib/core';
import pythonLang from 'highlight.js/lib/languages/python';
hljs.registerLanguage('python', pythonLang);
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
  saveFileToCache, fetchFileFromCache, saveRepoPaths, fetchRepoPaths,
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
function IconMoon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
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
function IconGitHub() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
    </svg>
  );
}

/* ── Themes ── */
const THEMES = ['github', 'midnight', 'notion'];
const THEME_META = {
  github:   { icon: <IconMoon />,   label: 'Midnight', next: 'midnight' },
  midnight: { icon: <IconNotion />, label: 'Notion',   next: 'notion' },
  notion:   { icon: <IconGitHub />, label: 'GitHub',   next: 'github' },
};
const THEME_COLOR = { github: '#0d1117', midnight: '#1a1726', notion: '#f7f6f3' };

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

/* ── Python Editor panel ── */
function PythonEditor({ onClose }) {
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const taRef  = useRef(null);
  const lnRef  = useRef(null);
  const hlRef  = useRef(null);

  const lineCount = useMemo(() => (code.match(/\n/g) || []).length + 1, [code]);

  // Syntax-highlighted HTML (github-dark colours via hljs)
  const highlighted = useMemo(() => {
    if (!code) return '';
    try { return hljs.highlight(code, { language: 'python' }).value; }
    catch { return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  }, [code]);

  const syncScroll = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    if (lnRef.current) lnRef.current.scrollTop = ta.scrollTop;
    if (hlRef.current) { hlRef.current.scrollTop = ta.scrollTop; hlRef.current.scrollLeft = ta.scrollLeft; }
  }, []);

  const handleKeyDown = useCallback((e) => {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: ss, selectionEnd: se, value } = ta;

    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        const lineStart = value.lastIndexOf('\n', ss - 1) + 1;
        if (value.slice(lineStart, lineStart + 4) === '    ') {
          setCode(value.slice(0, lineStart) + value.slice(lineStart + 4));
          requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = Math.max(lineStart, ss - 4); });
        }
      } else {
        setCode(value.slice(0, ss) + '    ' + value.slice(se));
        requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = ss + 4; });
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const lineStart = value.lastIndexOf('\n', ss - 1) + 1;
      const curLine   = value.slice(lineStart, ss);
      const indent    = curLine.match(/^(\s*)/)[1];
      const extra     = curLine.trimEnd().endsWith(':') ? '    ' : '';
      const next      = value.slice(0, ss) + '\n' + indent + extra + value.slice(se);
      setCode(next);
      const pos = ss + 1 + indent.length + extra.length;
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = pos; });
    }
  }, []);

  const handleCopy = useCallback(async () => {
    if (!code.trim()) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [code]);

  return (
    <div className="py-editor">
      <div className="py-header">
        <div className="py-title">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
          </svg>
          Python Editor
          <span className="py-title-badge">PY</span>
        </div>
        <div className="py-actions">
          <button className={`py-btn ${copied ? 'py-btn--copied' : ''}`} onClick={handleCopy} disabled={!code.trim()}>
            {copied
              ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>Copied</>
              : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy</>
            }
          </button>
          <button className="py-btn py-btn--clear" onClick={() => setCode('')} disabled={!code}>Clear</button>
          <button className="py-btn py-btn--close" onClick={onClose} title="Close">✕</button>
        </div>
      </div>

      <div className="py-body">
        <div className="py-lines" ref={lnRef} aria-hidden="true">
          {Array.from({ length: lineCount }, (_, i) => <span key={i}>{i + 1}</span>)}
        </div>
        <div className="py-code-wrap">
          {/* highlighted layer — behind textarea */}
          <pre
            ref={hlRef}
            className="py-highlight hljs"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: highlighted + '\n' }}
          />
          {/* editable layer — transparent text, caret only */}
          <textarea
            ref={taRef}
            className="py-textarea"
            value={code}
            onChange={e => setCode(e.target.value)}
            onKeyDown={handleKeyDown}
            onScroll={syncScroll}
            placeholder="# Write your Python code here…"
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>
      </div>

      <div className="py-footer">
        <span>{lineCount} line{lineCount !== 1 ? 's' : ''}</span>
        <span className="py-lang">Python 3</span>
      </div>
    </div>
  );
}

/* ── App ── */
export default function App() {
  const [theme, setTheme]               = useState('github');
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
  const [pyOpen, setPyOpen]             = useState(false);

  const { notebooks, save: saveNotebook, remove: removeNotebook } = useNotebooks();

  const {
    readFilesSet, streak, markRead, recordActivity,
    saveScrollPos, toggleHeading, scrollPositions, headingChecks, totalRead,
  } = useProgress(repo?.owner ?? null, repo?.repo ?? null);

  const savedScrollPct = readFilesSet.has(selectedPath)
    ? 0
    : (scrollPositions[selectedPath] ?? 0);

  // Theme persistence — migrate old 'dark'/'light' to 'github'
  useEffect(() => {
    const saved = localStorage.getItem('mdview-theme');
    if (THEMES.includes(saved)) setTheme(saved);
    else { setTheme('github'); localStorage.setItem('mdview-theme', 'github'); }
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

      const rid = `${owner}__${repoName}`;
      if (cachedPaths) {
        filePaths = cachedPaths;
      } else {
        try {
          filePaths = await fetchTree(owner, repoName, token);
          saveLocalCachePaths(owner, repoName, filePaths);
          saveRepoPaths(rid, filePaths); // cross-device path sharing
        } catch {
          snapshot = await fetchSnapshot(owner, repoName);
          if (snapshot) {
            filePaths = snapshot.paths;
          } else {
            const local = loadLocalCache(owner, repoName);
            if (local?.paths?.length) {
              filePaths = local.paths;
              snapshot = { ...local, fetchedAt: local.updatedAt, _local: true };
            } else {
              // Last resort: fetch path list from Supabase (saved by another device)
              const remotePaths = await fetchRepoPaths(rid);
              if (remotePaths?.length) {
                filePaths = remotePaths;
              } else {
                throw new Error('GitHub is unreachable and no offline snapshot found for this repo.');
              }
            }
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
        const rid = `${repo.owner}__${repo.repo}`;
        saveRepoPaths(rid, filePaths);

        // Background: fetch every file and push to Supabase so private/blocked
        // machines always get the latest version without needing GitHub access.
        (async () => {
          for (const p of filePaths) {
            try {
              const c = await fetchFile(repo.owner, repo.repo, p, repo.token);
              saveLocalCacheFile(repo.owner, repo.repo, p, c);
              saveFileToCache(rid, p, c);
            } catch { /* skip files that error */ }
          }
        })();
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
        // Supabase has the freshest content (saved by allowed machine) — check it first
        const supaContent = await fetchFileFromCache(repoId, path);
        if (supaContent !== null) {
          content = supaContent;
        } else {
          // Fall back to snapshot, then local cache
          content = repo.snapshot.files?.[path] ?? '';
          if (!content && repo.snapshot._local) {
            const local = loadLocalCache(repo.owner, repo.repo);
            content = local?.files?.[path] ?? '';
          }
          if (!content) {
            const local = loadLocalCache(repo.owner, repo.repo);
            content = local?.files?.[path] ?? '';
          }
        }
      } else {
        try {
          content = await fetchFile(repo.owner, repo.repo, path, repo.token);
          // Cache so blocked machines always get the latest version
          saveLocalCacheFile(repo.owner, repo.repo, path, content);
          saveFileToCache(`${repo.owner}__${repo.repo}`, path, content);
        } catch {
          // Supabase first (freshest), then CI snapshot, then local browser cache
          const supaContent = await fetchFileFromCache(repoId, path);
          if (supaContent !== null) {
            content = supaContent;
          } else {
            const snap = repo._snap ?? await fetchSnapshot(repo.owner, repo.repo);
            if (snap?.files?.[path] !== undefined) {
              content = snap.files[path];
              setRepo(r => ({ ...r, snapshot: snap, _snap: snap }));
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

      <main className={`content-area${pyOpen ? ' split' : ''}`}>
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
        {pyOpen && <PythonEditor onClose={() => setPyOpen(false)} />}
      </main>

      {/* Floating Python editor toggle */}
      <button
        className="py-toggle"
        onClick={() => setPyOpen(v => !v)}
        title={pyOpen ? 'Close Python editor' : 'Open Python editor'}
      >
        {pyOpen
          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        }
      </button>
    </div>
  );
}
