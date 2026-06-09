import { useState, useCallback, useEffect, useRef } from 'react';
import RepoForm from './components/RepoForm';
import FileTree from './components/FileTree';
import MarkdownView from './components/MarkdownView';
import Notebooks from './components/Notebooks';
import Breadcrumbs from './components/Breadcrumbs';
import Editor from './components/Editor';
import { useNotebooks } from './hooks/useNotebooks';
import { fetchTree, fetchFile, pushFile } from './github';
import './App.css';

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
function IconEdit() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function IconPlus() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}

function ThemeToggle({ theme, onToggle, iconOnly }) {
  return (
    <button className={`theme-toggle ${iconOnly ? 'icon-only' : ''}`} onClick={onToggle} title="Toggle theme">
      {theme === 'dark' ? <IconSun /> : <IconMoon />}
      {!iconOnly && <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>}
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
  const [fileSha, setFileSha]           = useState(null);
  const [loadingFile, setLoadingFile]   = useState(false);
  const [fileError, setFileError]       = useState('');

  const [editMode, setEditMode]         = useState(false);
  const [newFilePath, setNewFilePath]   = useState('');
  const [showNewFile, setShowNewFile]   = useState(false);
  const newFileRef = useRef(null);

  const [search, setSearch]             = useState('');
  const [sidebarOpen, setSidebarOpen]   = useState(true);

  const { notebooks, save: saveNotebook, remove: removeNotebook } = useNotebooks();

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  function closeSidebarOnMobile() {
    if (window.innerWidth < 768) setSidebarOpen(false);
  }

  async function loadRepo(owner, repoName, token, cachedPaths) {
    setLoadingRepo(true);
    setRepoError('');
    setPaths([]);
    setSelectedPath(null);
    setFileContent('');
    setFileSha(null);
    setSearch('');
    setEditMode(false);
    try {
      const filePaths = cachedPaths ?? await fetchTree(owner, repoName, token);
      if (filePaths.length === 0) {
        setRepoError('No markdown files found in this repository.');
        setRepo(null);
      } else {
        setRepo({ owner, repo: repoName, token });
        setPaths(filePaths);
        saveNotebook(owner, repoName, filePaths);
        if (window.innerWidth < 768) setSidebarOpen(true);
      }
    } catch (e) {
      setRepoError(e.message);
      setRepo(null);
    } finally {
      setLoadingRepo(false);
    }
  }

  const handleSelectFile = useCallback(async (path) => {
    if (!repo) return;
    setSelectedPath(path);
    setEditMode(false);
    setLoadingFile(true);
    setFileError('');
    setFileContent('');
    setFileSha(null);
    closeSidebarOnMobile();
    try {
      const { content, sha } = await fetchFile(repo.owner, repo.repo, path, repo.token);
      setFileContent(content);
      setFileSha(sha);
    } catch (e) {
      setFileError(e.message);
    } finally {
      setLoadingFile(false);
    }
  }, [repo]);

  async function handleSave({ content, message, sha }) {
    await pushFile({
      owner: repo.owner,
      repo: repo.repo,
      path: selectedPath,
      content,
      sha,
      token: repo.token,
      message,
    });
    // Update local state with new content
    setFileContent(content);
    // Re-fetch to get updated SHA
    try {
      const { sha: newSha } = await fetchFile(repo.owner, repo.repo, selectedPath, repo.token);
      setFileSha(newSha);
    } catch (_) {}
    // If new file, add to paths list
    if (!paths.includes(selectedPath)) {
      const updated = [...paths, selectedPath].sort();
      setPaths(updated);
      saveNotebook(repo.owner, repo.repo, updated);
    }
  }

  function handleCreateFile() {
    const p = newFilePath.trim();
    if (!p) return;
    const withExt = p.endsWith('.md') ? p : p + '.md';
    setSelectedPath(withExt);
    setFileContent('');
    setFileSha(null);
    setEditMode(true);
    setShowNewFile(false);
    setNewFilePath('');
    closeSidebarOnMobile();
  }

  function handleFolderClick(prefix) { setSearch(prefix); }

  const filteredPaths = search.trim()
    ? paths.filter(p => p.toLowerCase().startsWith(search.toLowerCase()) || p.toLowerCase().includes(search.toLowerCase()))
    : paths;

  /* ── Home ── */
  if (!repo && !loadingRepo) {
    return (
      <>
        <ThemeToggle theme={theme} onToggle={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} />
        {repoError && <div className="global-error">⚠ {repoError}</div>}
        <div className="home-wrap">
          <RepoForm onSubmit={({ owner, repo: r, token }) => loadRepo(owner, r, token, null)} loading={false} />
          <Notebooks notebooks={notebooks} onOpen={n => loadRepo(n.owner, n.repo, null, n.paths)} onRemove={removeNotebook} />
        </div>
      </>
    );
  }

  if (loadingRepo) {
    return (
      <div className="fullscreen-loader">
        <ThemeToggle theme={theme} onToggle={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} />
        <div className="spinner large" />
        <p>Fetching markdown files…</p>
      </div>
    );
  }

  const breadcrumbs = (
    <div className="bc-row">
      <Breadcrumbs repo={repo} selectedPath={selectedPath} onFolderClick={handleFolderClick} />
      {selectedPath && !editMode && (
        <button className="btn-edit" onClick={() => setEditMode(true)} title="Edit file">
          <IconEdit /> <span>Edit</span>
        </button>
      )}
      {editMode && (
        <button className="btn-edit editing" onClick={() => setEditMode(false)} title="Back to view">
          ← View
        </button>
      )}
    </div>
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
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {selectedPath && !editMode && (
            <button className="btn-edit icon-only" onClick={() => setEditMode(true)} title="Edit"><IconEdit /></button>
          )}
          {editMode && (
            <button className="btn-edit icon-only editing" onClick={() => setEditMode(false)} title="View">← View</button>
          )}
          <ThemeToggle theme={theme} onToggle={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} iconOnly />
        </div>
      </header>

      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-header-top">
            <button className="back-btn" onClick={() => { setRepo(null); setPaths([]); }}>← Back</button>
            <button
              className="btn-new-file"
              onClick={() => { setShowNewFile(v => !v); setTimeout(() => newFileRef.current?.focus(), 50); }}
              title="New file"
            >
              <IconPlus />
            </button>
          </div>
          <div className="repo-badge">
            <span className="dot" />
            <span>{repo.owner}/{repo.repo}</span>
          </div>
        </div>

        {showNewFile && (
          <div className="new-file-row">
            <input
              ref={newFileRef}
              className="new-file-input"
              placeholder="path/to/file.md"
              value={newFilePath}
              onChange={e => setNewFilePath(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateFile(); if (e.key === 'Escape') setShowNewFile(false); }}
            />
            <button className="new-file-confirm" onClick={handleCreateFile} disabled={!newFilePath.trim()}>Create</button>
          </div>
        )}

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
        {editMode ? (
          <Editor
            path={selectedPath}
            content={fileContent}
            sha={fileSha}
            repo={repo}
            isNew={!paths.includes(selectedPath)}
            onSave={handleSave}
            onCancel={() => setEditMode(false)}
          />
        ) : (
          <MarkdownView
            content={fileContent}
            path={selectedPath}
            loading={loadingFile}
            error={fileError}
            breadcrumbs={breadcrumbs}
          />
        )}
      </main>
    </div>
  );
}
