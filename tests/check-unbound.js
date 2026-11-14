const fs = require('fs');
const path = require('path');

function checkFile(htmlPath, jsPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const js = fs.readFileSync(jsPath, 'utf8');

  const idMatches = [...html.matchAll(/id=["']([^"']+)["']/g)].map(m => m[1]);
  const uniqueIds = [...new Set(idMatches)];

  console.log(`\n--- Checking ${path.basename(htmlPath)} vs ${path.basename(jsPath)} ---`);
  console.log(`Total HTML IDs: ${uniqueIds.length}`);

  const missingInJs = [];
  const inDomNotBound = [];

  for (const id of uniqueIds) {
    if (!js.includes(id)) {
      missingInJs.push(id);
    } else {
      // Check if it's a button or input and if addEventListener or .onclick exists
      const isActionElem = html.includes(`id="${id}"`) && (
        html.includes(`<button id="${id}"`) ||
        html.includes(`<input id="${id}"`) ||
        html.includes(`<select id="${id}"`)
      );
      if (isActionElem) {
        const bound = js.includes(`${id}?.addEventListener`) ||
                      js.includes(`${id}.addEventListener`) ||
                      js.includes(`'#${id}'`) ||
                      js.includes(`"${id}"`) && (js.includes(`addEventListener`) || js.includes(`onclick`));
        // We can do a more specific check
      }
    }
  }

  console.log('IDs completely missing in JS:', missingInJs);
}

checkFile(
  'C:\\Users\\Jing\\.gemini\\antigravity\\scratch\\AppWebpConverter\\editor\\index.html',
  'C:\\Users\\Jing\\.gemini\\antigravity\\scratch\\AppWebpConverter\\editor\\editor.js'
);

checkFile(
  'C:\\Users\\Jing\\.gemini\\antigravity\\scratch\\AppWebpConverter\\poster-studio\\index.html',
  'C:\\Users\\Jing\\.gemini\\antigravity\\scratch\\AppWebpConverter\\poster-studio\\poster-studio.js'
);

checkFile(
  'C:\\Users\\Jing\\.gemini\\antigravity\\scratch\\AppWebpConverter\\index.html',
  'C:\\Users\\Jing\\.gemini\\antigravity\\scratch\\AppWebpConverter\\app.js'
);
