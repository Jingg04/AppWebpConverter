// tests/test-editor-all-tools.js
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 8112;
const DEBUG_PORT = 9268;

function startServer() {
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml'
  };

  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath.endsWith('/')) reqPath += 'index.html';
    const filePath = path.join(ROOT_DIR, reqPath);

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found: ' + reqPath);
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp'
      });
      res.end(data);
    });
  });

  return new Promise((r) => server.listen(PORT, () => r(server)));
}

async function run() {
  const server = await startServer();
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,900'
  ]);

  await new Promise((r) => setTimeout(r, 1500));
  const tabs = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)).json();
  const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));

  let id = 1;
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const msgId = id++;
      const handler = (evt) => {
        const data = JSON.parse(evt.data);
        if (data.id === msgId) {
          ws.removeEventListener('message', handler);
          if (data.error) rej(data.error);
          else res(data.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

  await send('Page.enable');
  await send('Runtime.enable');

  const errors = [];
  ws.addEventListener('message', (evt) => {
    try {
      const data = JSON.parse(evt.data);
      if (data.method === 'Runtime.exceptionThrown') {
        errors.push(data.params?.exceptionDetails?.exception?.description || data.params?.exceptionDetails?.text);
      }
    } catch (_) {}
  });

  await send('Page.navigate', { url: `http://localhost:${PORT}/editor/` });
  await new Promise((r) => setTimeout(r, 1500));

  // Test Tool Action Matrix
  const results = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        const log = {};

        // 1. Click Sample Landscape
        const sampleBtn = document.getElementById("loadSampleLandscapeBtn");
        if (sampleBtn) {
          sampleBtn.click();
          log.sampleClicked = true;
        }
        await new Promise(r => setTimeout(r, 600));

        const editorState = window.FluxEditor?.getState?.();
        log.layersCount = editorState?.doc?.layers?.length || 0;
        log.docWidth = editorState?.doc?.width;
        log.docHeight = editorState?.doc?.height;

        // 2. Test Tool switching
        const tools = ['crop', 'resize', 'transform', 'bg-remover', 'adjust', 'filter', 'text', 'shapes', 'draw', 'watermark', 'background'];
        log.toolSwitches = {};
        for (const t of tools) {
          const btn = document.querySelector(\`[data-tool="\${t}"]\`);
          if (btn) {
            btn.click();
            log.toolSwitches[t] = true;
          } else {
            log.toolSwitches[t] = false;
          }
        }

        // 3. Test Add Text Layer
        const addTextBtn = document.getElementById("addTextBtn") || document.querySelector('.btn-add-text');
        if (addTextBtn) {
          addTextBtn.click();
          log.textAdded = true;
        }

        // 4. Test Add Shape Layer
        const addRectBtn = document.getElementById("addRectBtn") || document.querySelector('.btn-add-rect');
        if (addRectBtn) {
          addRectBtn.click();
          log.shapeAdded = true;
        }

        // 5. Test Export
        const exportBtn = document.getElementById("headerExportBtn");
        if (exportBtn) {
          exportBtn.click();
          log.exportBtnClicked = true;
        }
        await new Promise(r => setTimeout(r, 400));
        const exportTab = document.getElementById("tabExport");
        log.exportTabActive = exportTab ? exportTab.classList.contains("active") : false;

        return log;
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Editor Tools Test Results:', results.result?.value);
  console.log('Runtime exceptions during test:', errors);

  ws.close();
  chrome.kill();
  server.close();
}
run().catch(console.error);
