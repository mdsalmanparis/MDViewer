import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import rehypeRaw from 'rehype-raw';
import 'highlight.js/styles/github-dark.css';

export default function MarkdownView({ content, path, loading, error, breadcrumbs }) {
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
          <div className="md-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkBreaks]}
              rehypePlugins={[rehypeRaw, rehypeHighlight, rehypeSlug]}
            >
              {content}
            </ReactMarkdown>
          </div>
        </article>
      )}
    </div>
  );
}
