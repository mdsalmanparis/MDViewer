import { useState, useEffect } from 'react';

const KEY = 'mdview-notebooks';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; }
  catch { return []; }
}

export function useNotebooks() {
  const [notebooks, setNotebooks] = useState(load);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(notebooks));
  }, [notebooks]);

  function save(owner, repo, paths) {
    const id = `${owner}/${repo}`;
    setNotebooks(prev => {
      const filtered = prev.filter(n => n.id !== id);
      return [{ id, owner, repo, paths, fileCount: paths.length, lastVisited: new Date().toISOString() }, ...filtered].slice(0, 12);
    });
  }

  function remove(id) {
    setNotebooks(prev => prev.filter(n => n.id !== id));
  }

  return { notebooks, save, remove };
}
