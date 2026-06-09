export function buildTree(paths) {
  const root = { __children: {} };
  for (const path of paths) {
    const parts = path.split('/');
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!node.__children[part]) {
        node.__children[part] = { __children: {}, __path: null };
      }
      node = node.__children[part];
      if (i === parts.length - 1) node.__path = path;
    }
  }
  return root.__children;
}
