import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const targets = [
  'node_modules/@firebase/firestore/dist/index.esm2017.js',
  'node_modules/@firebase/firestore/dist/index.cjs.js',
  'node_modules/@firebase/firestore/dist/index.node.cjs.js',
  'node_modules/@firebase/firestore/dist/index.node.mjs',
  'node_modules/@firebase/firestore/dist/index.rn.js',
  'node_modules/.vite/deps/firebase_firestore.js',
];

let totalPatched = 0;

for (const relPath of targets) {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) continue;

  try {
    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;

    // Pattern 1: minified browser/esm (this.ve -= 1, hardAssert(this.ve >= 0, 3241))
    if (content.includes('this.ve -= 1') && content.includes('3241')) {
      content = content.replace(
        /this\.ve\s*-=\s*1\s*,\s*__PRIVATE_hardAssert\s*\(\s*this\.ve\s*>=\s*0\s*,\s*3241/g,
        'this.ve = Math.max(0, this.ve - 1), __PRIVATE_hardAssert(true, 3241'
      );
      content = content.replace(
        /this\.ve\s*-=\s*1\s*,\s*hardAssert\s*\(\s*this\.ve\s*>=\s*0\s*,\s*3241/g,
        'this.ve = Math.max(0, this.ve - 1), hardAssert(true, 3241'
      );
      modified = true;
    }

    // Pattern 2: node cjs (this.pendingResponses -= 1; hardAssert(this.pendingResponses >= 0, 0x0ca9))
    if (content.includes('this.pendingResponses -= 1') && (content.includes('0x0ca9') || content.includes('3241'))) {
      content = content.replace(
        /this\.pendingResponses\s*-=\s*1\s*;\s*hardAssert\s*\(\s*this\.pendingResponses\s*>=\s*0\s*,\s*0x0ca9/g,
        'this.pendingResponses = Math.max(0, this.pendingResponses - 1); hardAssert(true, 0x0ca9'
      );
      content = content.replace(
        /this\.pendingResponses\s*-=\s*1\s*;\s*hardAssert\s*\(\s*this\.pendingResponses\s*>=\s*0\s*,\s*3241/g,
        'this.pendingResponses = Math.max(0, this.pendingResponses - 1); hardAssert(true, 3241'
      );
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`[patch-firestore] Successfully patched: ${relPath}`);
      totalPatched++;
    }
  } catch (err) {
    console.error(`[patch-firestore] Error patching ${relPath}:`, err);
  }
}

console.log(`[patch-firestore] Done. Total files patched: ${totalPatched}`);
