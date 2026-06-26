import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import rehypeRaw from 'rehype-raw';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import { isMarkdown, getLang, getExt } from '../fileTypes';

/* ── Copy button ── */
function CopyButton({ getText }) {
  const [state, setState] = useState('idle');

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(getText());
      setState('copied');
      setTimeout(() => setState('idle'), 2000);
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 2000);
    }
  }, [getText]);

  return (
    <button className={`code-copy-btn ${state}`} onClick={handleCopy} title="Copy code" aria-label="Copy code">
      {state === 'copied' ? (
        <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span>Copied!</span></>
      ) : state === 'error' ? (
        <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg><span>Failed</span></>
      ) : (
        <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>Copy</span></>
      )}
    </button>
  );
}

/* ── Code block inside markdown ── */
function CodeBlock({ children, ...props }) {
  const getText = useCallback(() => {
    function extract(node) {
      if (typeof node === 'string') return node;
      if (Array.isArray(node)) return node.map(extract).join('');
      if (node?.props?.children) return extract(node.props.children);
      return '';
    }
    return extract(children);
  }, [children]);

  return (
    <div className="code-block-wrap">
      <CopyButton getText={getText} />
      <pre {...props}>{children}</pre>
    </div>
  );
}

/* ── Full-file code view (for non-markdown files) ── */
function CodeFileView({ content, path }) {
  const lang = getLang(path);
  const ext  = getExt(path);

  const highlighted = useMemo(() => {
    try {
      if (lang !== 'plaintext' && hljs.getLanguage(lang)) {
        return hljs.highlight(content, { language: lang }).value;
      }
      return hljs.highlightAuto(content).value;
    } catch {
      return content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  }, [content, lang]);

  return (
    <div className="code-file-wrap">
      <div className="code-file-header">
        <span className="code-file-lang-badge">{ext}</span>
        <CopyButton getText={() => content} />
      </div>
      <pre className="code-file-pre">
        <code className={`hljs language-${lang}`} dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  );
}

/* ── Reading progress bar ── */
// Minimum seconds the user must spend on a file before scroll-to-bottom marks it read.
// Prevents accidental completion from fast-scrolling.
const MIN_READ_SECONDS = 20;

function ReadingProgress({ scrollRef, path, onMarkRead, onScrollChange }) {
  const [pct, setPct]   = useState(0);
  const markedRef       = useRef(false);
  const debounceRef     = useRef(null);
  const checkTimerRef   = useRef(null);
  const openedAtRef     = useRef(Date.now());

  useEffect(() => {
    setPct(0);
    markedRef.current   = false;
    openedAtRef.current = Date.now();
    clearTimeout(checkTimerRef.current);
  }, [path]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function tryMarkRead(p) {
      if (markedRef.current || p < 95 || !onMarkRead) return;
      const elapsed = (Date.now() - openedAtRef.current) / 1000;
      if (elapsed >= MIN_READ_SECONDS) {
        markedRef.current = true;
        onMarkRead(path);
      } else {
        // Schedule a deferred check — fires when the time gate opens
        clearTimeout(checkTimerRef.current);
        checkTimerRef.current = setTimeout(() => {
          if (markedRef.current) return;
          const { scrollTop, scrollHeight, clientHeight } = el;
          const total = scrollHeight - clientHeight;
          const cur = total > 0 ? Math.min(100, (scrollTop / total) * 100) : 0;
          if (cur >= 95) {        // still near the bottom after waiting
            markedRef.current = true;
            onMarkRead(path);
          }
        }, (MIN_READ_SECONDS - elapsed) * 1000);
      }
    }

    function onScroll() {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const total = scrollHeight - clientHeight;
      const p = total > 0 ? Math.min(100, (scrollTop / total) * 100) : 0;
      setPct(p);
      tryMarkRead(p);

      if (onScrollChange) {
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => onScrollChange(path, p), 600);
      }
    }

    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      el.removeEventListener('scroll', onScroll);
      clearTimeout(debounceRef.current);
      clearTimeout(checkTimerRef.current);
    };
  }, [scrollRef, path, onMarkRead, onScrollChange]);

  return (
    <div className="reading-progress-track">
      <div className="reading-progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ── Main view ── */
export default function MarkdownView({
  content,
  path,
  loading,
  error,
  breadcrumbs,
  onMarkRead,
  onScrollChange,
  savedScrollPct,
}) {
  const isMd = isMarkdown(path || '');
  const articleRef = useRef(null);
  const restoredRef = useRef(null); // track which path we already restored

  // Restore scroll position when content loads for a new path
  useEffect(() => {
    if (!content || loading || !articleRef.current) return;
    if (!savedScrollPct || savedScrollPct <= 0) return;
    if (restoredRef.current === path) return; // already restored this path
    restoredRef.current = path;

    const el = articleRef.current;
    const timer = setTimeout(() => {
      const total = el.scrollHeight - el.clientHeight;
      if (total > 0) el.scrollTop = total * (savedScrollPct / 100);
    }, 80);
    return () => clearTimeout(timer);
  }, [path, content, savedScrollPct, loading]);

  // Reset restored flag when path changes
  useEffect(() => { restoredRef.current = null; }, [path]);

  return (
    <div className="md-outer">
      {breadcrumbs && <div className="bc-bar">{breadcrumbs}</div>}

      {content && !loading && !error && (
        <ReadingProgress
          scrollRef={articleRef}
          path={path}
          onMarkRead={onMarkRead}
          onScrollChange={onScrollChange}
        />
      )}

      {loading && (
        <div className="md-placeholder">
          <div className="spinner" />
          <p>Loading…</p>
        </div>
      )}

      {!loading && error && (
        <div className="md-placeholder error">
          <p>⚠ {error}</p>
        </div>
      )}

      {!loading && !error && !content && (
        <div className="md-placeholder">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p>Select a file from the sidebar</p>
        </div>
      )}

      {!loading && !error && content && (
        <article className="md-article" ref={articleRef}>
          {isMd ? (
            <div className="md-body">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                rehypePlugins={[rehypeRaw, rehypeHighlight, rehypeSlug]}
                components={{ pre: CodeBlock }}
              >
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <CodeFileView content={content} path={path} />
          )}
        </article>
      )}
    </div>
  );
}
