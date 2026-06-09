/* ── Supported file extensions ── */
export const CODE_EXTS = new Set([
  // Markdown
  'md', 'mdx',
  // Python
  'py', 'pyw',
  // JavaScript / TypeScript
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx',
  // Java / JVM
  'java', 'kt', 'kts', 'scala', 'groovy',
  // C family
  'c', 'h', 'cpp', 'cc', 'cxx', 'hpp', 'cs',
  // Go, Rust, Ruby, PHP, Swift, Dart
  'go', 'rs', 'rb', 'php', 'swift', 'dart',
  // Shell
  'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat',
  // Web
  'html', 'htm', 'css', 'scss', 'sass', 'less',
  // Data / config
  'json', 'yaml', 'yml', 'toml', 'xml', 'ini', 'env',
  // SQL
  'sql',
  // Other
  'r', 'lua', 'vim', 'txt', 'rst',
]);

/* Extension → highlight.js language alias */
const EXT_LANG = {
  // Markdown
  md: 'markdown', mdx: 'markdown',
  // Python
  py: 'python', pyw: 'python',
  // JS / TS
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  // JVM
  java: 'java', kt: 'kotlin', kts: 'kotlin',
  scala: 'scala', groovy: 'groovy',
  // C family
  c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp',
  cs: 'csharp',
  // Systems
  go: 'go', rs: 'rust', rb: 'ruby',
  php: 'php', swift: 'swift', dart: 'dart',
  // Shell
  sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'bash',
  ps1: 'powershell', bat: 'dos',
  // Web
  html: 'html', htm: 'html',
  css: 'css', scss: 'scss', sass: 'scss', less: 'less',
  // Data
  json: 'json', yaml: 'yaml', yml: 'yaml',
  toml: 'ini', xml: 'xml', ini: 'ini', env: 'bash',
  sql: 'sql',
  // Other
  r: 'r', lua: 'lua', vim: 'vim',
  txt: 'plaintext', rst: 'plaintext',
};

export function getExt(path) {
  const parts = path.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

export function isMarkdown(path) {
  const ext = getExt(path);
  return ext === 'md' || ext === 'mdx';
}

export function getLang(path) {
  return EXT_LANG[getExt(path)] || 'plaintext';
}
