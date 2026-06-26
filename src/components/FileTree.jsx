import { useState } from 'react';
import { buildTree } from '../fileTree';
import { isMarkdown } from '../fileTypes';

function IconChevronRight() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

function IconFolder({ open }) {
  return open ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      <line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function IconFile() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="9" y1="13" x2="15" y2="13"/>
      <line x1="9" y1="17" x2="13" y2="17"/>
    </svg>
  );
}

function IconCode() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/>
      <polyline points="8 6 2 12 8 18"/>
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

// Count total files and read files recursively in a subtree node
function countSubtree(node, readFiles) {
  let total = 0, read = 0;
  for (const child of Object.values(node.__children)) {
    const hasChildren = Object.keys(child.__children).length > 0;
    if (hasChildren) {
      const c = countSubtree(child, readFiles);
      total += c.total;
      read  += c.read;
    } else {
      total++;
      if (readFiles?.has(child.__path)) read++;
    }
  }
  return { total, read };
}

function TreeNode({ name, node, onSelect, selected, depth, readFiles }) {
  const isFolder = Object.keys(node.__children).length > 0;
  const [open, setOpen] = useState(depth < 2);

  if (isFolder) {
    const { total, read } = countSubtree(node, readFiles);
    const allRead = read === total && total > 0;

    return (
      <div className="tree-folder">
        <button
          className="tree-folder-btn"
          onClick={() => setOpen(v => !v)}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          <span className={`tree-arrow ${open ? 'open' : ''}`}><IconChevronRight /></span>
          <span className="tree-folder-icon"><IconFolder open={open} /></span>
          <span className="tree-name">{name}</span>
          {read > 0 && (
            <span className={`tree-folder-count ${allRead ? 'all-read' : ''}`}>
              {allRead ? <IconCheck /> : `${read}/${total}`}
            </span>
          )}
        </button>
        {open && (
          <div className="tree-children">
            {Object.entries(node.__children)
              .sort(treeSort)
              .map(([childName, childNode]) => (
                <TreeNode
                  key={childName}
                  name={childName}
                  node={childNode}
                  onSelect={onSelect}
                  selected={selected}
                  depth={depth + 1}
                  readFiles={readFiles}
                />
              ))}
          </div>
        )}
      </div>
    );
  }

  const isMd  = isMarkdown(node.__path || '');
  const isRead = readFiles?.has(node.__path);

  return (
    <button
      className={`tree-file-btn ${selected === node.__path ? 'active' : ''} ${!isMd ? 'tree-file-code' : ''} ${isRead ? 'tree-file-read' : ''}`}
      onClick={() => onSelect(node.__path)}
      style={{ paddingLeft: `${depth * 14 + 8}px` }}
      title={node.__path}
    >
      <span className={`tree-file-icon ${!isMd ? 'tree-code-icon' : ''}`}>
        {isMd ? <IconFile /> : <IconCode />}
      </span>
      <span className="tree-name">{name}</span>
      {isRead && <span className="tree-read-tick"><IconCheck /></span>}
    </button>
  );
}

// Natural sort: "Module 2" before "Module 10", folders before files
function treeSort([nameA, nodeA], [nameB, nodeB]) {
  const aFolder = Object.keys(nodeA.__children).length > 0;
  const bFolder = Object.keys(nodeB.__children).length > 0;
  if (aFolder !== bFolder) return bFolder - aFolder; // folders first
  return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
}

export default function FileTree({ paths, onSelect, selected, readFiles }) {
  const tree = buildTree(paths);
  return (
    <nav className="file-tree">
      {Object.entries(tree)
        .sort(treeSort)
        .map(([name, node]) => (
          <TreeNode
            key={name}
            name={name}
            node={node}
            onSelect={onSelect}
            selected={selected}
            depth={0}
            readFiles={readFiles}
          />
        ))}
    </nav>
  );
}
