const fs = require('fs');
const path = require('path');

// Let's search all files for button elements and their surrounding hierarchy
const srcDir = path.join(__dirname, '..', 'src');

function walk(dir) {
  let files = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      files = files.concat(walk(full));
    } else if (full.endsWith('.tsx')) {
      files.push(full);
    }
  }
  return files;
}

const allFiles = walk(srcDir);
console.log(`Found ${allFiles.length} tsx files.`);

// Target selector:
// div#root > div:1 > div:1 > div:1 > div:2 > div:1 > div:2 > div:2 > div:2 > button:1
// That is:
// root (div#root)
// 1. div (1st div in root)
// 2. div (1st div)
// 3. div (1st div)
// 4. div (2nd div)
// 5. div (1st div)
// 6. div (2nd div)
// 7. div (2nd div)
// 8. div (2nd div)
// 9. button (1st button)

// Let's look closely at:
// If step 1 is RootApplicationRouter:
// root -> <div className="h-dvh..."> (div:1) -> <div className="flex-1..."> (div:1)
// Next is what is rendered inside RootApplicationRouter!
// Inside RootApplicationRouter, either:
// A) MasterAdminPortalWebsite
// B) App

// Let's check MasterAdminPortalWebsite vs App vs CoreLoggingWorkspace vs CoreDataAndStorageModal!
