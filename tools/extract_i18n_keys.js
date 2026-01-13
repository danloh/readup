const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'src');
const outFile = path.join(__dirname, 'translation_keys.txt');
const exts = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);

function walk(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(full, files);
    } else if (e.isFile() && exts.has(path.extname(e.name))) {
      files.push(full);
    }
  }
  return files;
}

const files = walk(root);
const keySet = new Set();
// Match either single-quoted or double-quoted strings, handle escaped quotes, avoid crossing unrelated quotes
const re = /_\(\s*'((?:[^'\\]|\\.)*)'\s*\)|_\(\s*"((?:[^"\\]|\\.)*)"\s*\)/gm;

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = re.exec(content)) !== null) {
    const key = (m[1] || m[2] || '').replace(/\\n/g, '\n').replace(/\r?\n/g, ' ').trim();
    if (key) keySet.add(key);
  }
}

const keys = Array.from(keySet).sort((a,b)=> a.localeCompare(b));
fs.writeFileSync(outFile, keys.join('\n') + '\n', 'utf8');
console.log('Wrote', keys.length, 'keys to', outFile);
