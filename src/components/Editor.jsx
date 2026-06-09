import { useState, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';

/* ── Toolbar action definitions ── */
const TOOLS = [
  { id: 'h1',    label: 'H1', title: 'Heading 1',    block: true,  wrap: null,   prefix: '# ' },
  { id: 'h2',    label: 'H2', title: 'Heading 2',    block: true,  wrap: null,   prefix: '## ' },
  { id: 'h3',    label: 'H3', title: 'Heading 3',    block: true,  wrap: null,   prefix: '### ' },
  { id: 'sep1' },
  { id: 'bold',  icon: 'B',   title: 'Bold (Ctrl+B)', wrap: '**' },
  { id: 'italic',icon: 'I',   title: 'Italic (Ctrl+I)', wrap: '*' },
  { id: 'strike',icon: 'S̶',   title: 'Strikethrough', wrap: '~~' },
  { id: 'sep2' },
  { id: 'quote', icon: '❝',   title: 'Blockquote',   block: true,  prefix: '> ' },
  { id: 'ul',    icon: '•—',  title: 'Bullet list',  block: true,  prefix: '- ' },
  { id: 'ol',    icon: '1.',  title: 'Numbered list', block: true,  prefix: '1. ' },
  { id: 'sep3' },
  { id: 'code',  icon: '`',   title: 'Inline code',  wrap: '`' },
  { id: 'codeblock', icon: '```', title: 'Code block', codeblock: true },
  { id: 'link',  icon: '🔗',  title: 'Link',         link: true },
  { id: 'hr',    icon: '—',   title: 'Horizontal rule', hr: true },
];

function applyTool(tool, textarea) {
  const el = textarea;
  const start = el.selectionStart;
  const end   = el.selectionEnd;
  const val   = el.value;
  const sel   = val.slice(start, end);
  let newVal, cursor;

  if (tool.hr) {
    const before = val.slice(0, start);
    const after  = val.slice(end);
    const nl = before.length && !before.endsWith('\n') ? '\n' : '';
    newVal = before + nl + '\n---\n\n' + after;
    cursor = start + nl.length + 6;
  } else if (tool.link) {
    const text = sel || 'link text';
    const inserted = `[${text}](url)`;
    newVal = val.slice(0, start) + inserted + val.slice(end);
    cursor = start + inserted.length - 4; // position at 'url'
  } else if (tool.codeblock) {
    const lang = '';
    const inserted = `\`\`\`${lang}\n${sel || 'code'}\n\`\`\``;
    newVal = val.slice(0, start) + inserted + val.slice(end);
    cursor = start + 3; // after ```
  } else if (tool.block) {
    const lineStart = val.lastIndexOf('\n', start - 1) + 1;
    const line = val.slice(lineStart, end || val.indexOf('\n', lineStart) || val.length);
    const already = line.startsWith(tool.prefix);
    const replacement = already ? line.slice(tool.prefix.length) : tool.prefix + (sel || 'text');
    newVal = val.slice(0, lineStart) + replacement + val.slice(end > lineStart ? end : lineStart + line.length);
    cursor = lineStart + replacement.length;
  } else if (tool.wrap) {
    const w = tool.wrap;
    const already = sel.startsWith(w) && sel.endsWith(w);
    if (already) {
      newVal = val.slice(0, start) + sel.slice(w.length, -w.length) + val.slice(end);
      cursor = start + sel.length - w.length * 2;
    } else {
      const text = sel || 'text';
      newVal = val.slice(0, start) + w + text + w + val.slice(end);
      cursor = start + w.length + text.length + w.length;
    }
  } else return;

  el.value = newVal;
  el.selectionStart = el.selectionEnd = cursor;
  el.focus();
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

export default function Editor({ path, content: initial, sha, repo, onSave, onCancel, isNew }) {
  const [text, setText]       = useState(initial || '');
  const [view, setView]       = useState('split'); // 'edit' | 'split' | 'preview'
  const [saving, setSaving]   = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [msg, setMsg]         = useState(isNew ? `Add ${path}` : `Update ${path.split('/').pop()}`);
  const [saved, setSaved]     = useState(false);
  const textareaRef = useRef(null);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.target;
      const s = el.selectionStart;
      el.setRangeText('  ', s, el.selectionEnd, 'end');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      applyTool(TOOLS.find(t => t.id === 'bold'), el);
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      applyTool(TOOLS.find(t => t.id === 'italic'), textareaRef.current);
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      doSave();
    }
  }, [text, msg]);

  async function doSave() {
    if (!msg.trim()) return;
    setSaving(true);
    setSaveErr('');
    try {
      await onSave({ content: text, message: msg.trim(), sha: isNew ? null : sha });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSaveErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  const dirty = text !== initial;

  return (
    <div className="editor-shell">
      {/* Save bar */}
      <div className="editor-topbar">
        <div className="editor-path">{path}</div>
        <div className="editor-actions">
          <input
            className="commit-msg-input"
            value={msg}
            onChange={e => setMsg(e.target.value)}
            placeholder="Commit message…"
            onKeyDown={e => e.key === 'Enter' && doSave()}
          />
          <button
            className={`btn-save ${saved ? 'saved' : ''}`}
            onClick={doSave}
            disabled={saving || !msg.trim()}
            title="Save & push (Ctrl+S)"
          >
            {saving ? <span className="spinner-sm" /> : saved ? '✓ Pushed' : '↑ Push'}
          </button>
          <button className="btn-discard" onClick={onCancel} title="Discard changes">
            ✕
          </button>
        </div>
      </div>

      {saveErr && <div className="editor-error">⚠ {saveErr}</div>}

      {/* View toggle */}
      <div className="editor-viewbar">
        <div className="view-tabs">
          {['edit','split','preview'].map(v => (
            <button
              key={v}
              className={`view-tab ${view === v ? 'active' : ''}`}
              onClick={() => setView(v)}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        {/* Toolbar */}
        <div className="editor-toolbar">
          {TOOLS.map(t => {
            if (t.id.startsWith('sep')) return <span key={t.id} className="toolbar-sep" />;
            return (
              <button
                key={t.id}
                className="toolbar-btn"
                title={t.title}
                onMouseDown={e => { e.preventDefault(); applyTool(t, textareaRef.current); }}
              >
                {t.icon || t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Panes */}
      <div className={`editor-panes view-${view}`}>
        {view !== 'preview' && (
          <div className="editor-pane editor-write">
            <textarea
              ref={textareaRef}
              className="editor-textarea"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              autoComplete="off"
              placeholder="Start writing markdown…"
            />
          </div>
        )}
        {view !== 'edit' && (
          <div className="editor-pane editor-preview">
            <div className="md-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeHighlight]}>
                {text || '*Nothing to preview*'}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
