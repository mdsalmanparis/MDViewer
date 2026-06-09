import { useState, useCallback, useMemo } from 'react';
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

/* ── Main view ── */
export default function MarkdownView({ content, path, loading, error, breadcrumbs }) {
  const isMd = isMarkdown(path || '');

  return (
    <div className="md-outer">
      {breadcrumbs && <div className="bc-bar">{breadcrumbs}</div>}

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
        <article className="md-article">
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
