const ts = require('typescript');
const fs = require('fs');
const path = require('path');

function getElementTag(node) {
  if (ts.isJsxElement(node)) {
    return node.openingElement.tagName.getText();
  }
  if (ts.isJsxSelfClosingElement(node)) {
    return node.tagName.getText();
  }
  return null;
}

const files = [
  'src/components/CoreLoggingWorkspace.tsx',
  'src/App.tsx'
];

for (const rel of files) {
  const filePath = path.join(__dirname, '..', rel);
  if (!fs.existsSync(filePath)) continue;
  const content = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  function checkButtons(node, stack = []) {
    const tag = getElementTag(node);
    if (tag) {
      const currentStack = [...stack, { tag, node }];
      if (tag === 'button') {
        const text = node.getText().slice(0, 150).replace(/\s+/g, ' ');
        const pathStr = currentStack.map(s => s.tag).join(' > ');
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        if (rel.includes('CoreLogging')) {
          console.log(`[${rel}:${line}] ${pathStr} | ${text}`);
        } else if (text.toLowerCase().includes('core') || (line >= 4180 && line <= 4340)) {
          console.log(`[${rel}:${line}] ${pathStr} | ${text}`);
        }
      }
    }
    ts.forEachChild(node, c => checkButtons(c, tag ? [...stack, { tag, node }] : stack));
  }

  checkButtons(sourceFile);
}
