import fs from 'fs';
import path from 'path';

const allFiles = new Set();
function walk(dir: string) {
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (/\.(tsx?|jsx?|css)$/.test(full)) allFiles.add(path.resolve(full));
  }
}
walk('src');

const reachable = new Set();
const queue = [path.resolve('src/main.tsx'), path.resolve('server.ts')];

function resolveImport(importPath: string, currentFile: string): string | null {
  const dir = path.dirname(currentFile);
  const extensions = ['.tsx', '.ts', '.jsx', '.js', '.css', '/index.tsx', '/index.ts'];
  let resolved = path.resolve(dir, importPath);
  if (fs.existsSync(resolved) && !fs.statSync(resolved).isDirectory()) return resolved;
  for (const ext of extensions) {
    if (fs.existsSync(resolved + ext)) return resolved + ext;
  }
  return null;
}

while (queue.length > 0) {
  const file = queue.shift()!;
  if (reachable.has(file)) continue;
  reachable.add(file);

  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, 'utf8');
  const importRegex = /(?:import|export)\s+(?:[\s\S]*?from\s+)?['"]([./][^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const resolved = resolveImport(match[1], file);
    if (resolved && allFiles.has(resolved) && !reachable.has(resolved)) {
      queue.push(resolved);
    }
  }
}

console.log('TOTAL FILES IN SRC:', allFiles.size);
console.log('REACHABLE FILES:', reachable.size);
console.log('UNREACHABLE FILES:');
for (const file of Array.from(allFiles).sort()) {
  if (!reachable.has(file)) {
    console.log(' - ' + path.relative(process.cwd(), file as string));
  }
}
