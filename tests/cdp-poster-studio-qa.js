const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const ARTIFACT_DIR = 'C:\\Users\\Jing\\.gemini\\antigravity\\brain\\4bfb2196-d35a-43e7-b203-574e8e301ba2';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 8090;
const DEBUG_PORT = 9224;

// Lightweight static HTTP server
function startServer() {
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
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
        res.end('Not found');
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

  return new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(`Test static server running on http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

async function run() {
  const server = await startServer();

  console.log('Launching headless Chrome for Poster Studio QA...');
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--window-size=1920,1080',
    `http://localhost:${PORT}/poster-studio/`
  ]);

  chrome.on('error', (err) => console.error('Chrome process error:', err));

  let tabs = null;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      tabs = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${DEBUG_PORT}/json`, (res) => {
          let d = '';
          res.on('data', (c) => (d += c));
          res.on('end', () => {
            try {
              resolve(JSON.parse(d));
            } catch (e) {
              reject(e);
            }
          });
        }).on('error', reject);
      });
      if (tabs && tabs.length > 0) break;
    } catch (_) {}
  }

  if (!tabs) {
    console.error('Failed to connect to Chrome DevTools port');
    chrome.kill();
    server.close();
    process.exit(1);
  }

  const page = tabs.find((t) => t.type === 'page' && t.url.includes('poster-studio')) || tabs[0];
  console.log(`Connected to page: ${page.url}`);

  const ws = new WebSocket(page.webSocketDebuggerUrl);

  let id = 1;
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      const timeout = setTimeout(() => {
        ws.removeEventListener('message', handler);
        reject(new Error(`CDP method ${method} timed out`));
      }, 15000);

      const handler = (evt) => {
        const res = JSON.parse(evt.data);
        if (res.id === msgId) {
          clearTimeout(timeout);
          ws.removeEventListener('message', handler);
          if (res.error) reject(new Error(res.error.message));
          else resolve(res.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  await new Promise((resolve) => ws.addEventListener('open', resolve));
  console.log('DevTools WebSocket connected.');

  await send('Page.enable');
  await send('Runtime.enable');
  await new Promise((r) => setTimeout(r, 1000));

  // Step 1: Verify Initial Workspace State
  const initialCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      return JSON.stringify({
        title: document.title,
        hasCanvas: !!document.getElementById('posterCanvas'),
        canvasW: document.getElementById('posterCanvas')?.width,
        canvasH: document.getElementById('posterCanvas')?.height,
        projectTitle: document.getElementById('projectTitleInput')?.value,
        hasNavRail: document.querySelectorAll('.rail-btn').length,
        hasExportBtn: !!document.getElementById('btnOpenExportModal'),
        hasOpenEditorBtn: !!document.getElementById('btnOpenInEditor')
      });
    })()`,
    returnByValue: true
  });
  console.log('1. Initial Poster Studio State:', initialCheck.result?.value);

  // Capture Screenshot 1: Poster Studio Home (Default Sneaker Template)
  const ss1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'qa-poster-studio-home.png'), Buffer.from(ss1.data, 'base64'));
  console.log('Captured qa-poster-studio-home.png');

  // Step 2: Open Templates Tab & Inspect 18 Categories
  console.log('2. Opening Templates Tab...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const tmplBtn = document.querySelector('.rail-btn[data-tab="templates"]');
      if (tmplBtn) tmplBtn.click();
      return true;
    })()`
  });
  await new Promise((r) => setTimeout(r, 600));

  const tmplCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      return JSON.stringify({
        isPanelVisible: !document.getElementById('panelTemplates').classList.contains('hidden'),
        categoriesCount: document.querySelectorAll('.cat-pill').length,
        templatesCount: document.querySelectorAll('.template-item-card').length
      });
    })()`,
    returnByValue: true
  });
  console.log('2. Templates Catalog Status:', tmplCheck.result?.value);

  // Capture Screenshot 2: Templates Catalog
  const ss2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'qa-poster-studio-templates-catalog.png'), Buffer.from(ss2.data, 'base64'));
  console.log('Captured qa-poster-studio-templates-catalog.png');

  // Step 3: Select Industrial Titan CNC Template
  console.log('3. Loading Industrial Titan CNC Template...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const card = document.querySelector('.template-item-card[data-template-id="ind-titan-cnc"]');
      if (card) card.click();
      return true;
    })()`
  });
  await new Promise((r) => setTimeout(r, 800));

  const titanCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const engine = window.FluxPosterStudio.getEngine();
      return JSON.stringify({
        projectTitle: document.getElementById('projectTitleInput')?.value,
        layersCount: engine.doc.layers.length,
        canvasW: engine.doc.width,
        canvasH: engine.doc.height,
        headlineText: engine.doc.layers.find(l => l.name === 'Industrial Headline')?.text
      });
    })()`,
    returnByValue: true
  });
  console.log('3. Titan CNC Loaded State:', titanCheck.result?.value);

  // Capture Screenshot 3: Titan CNC Poster
  const ss3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'qa-poster-studio-template-cnc.png'), Buffer.from(ss3.data, 'base64'));
  console.log('Captured qa-poster-studio-template-cnc.png');

  // Step 4: Open Export Modal
  console.log('4. Opening Export Modal...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      document.getElementById('btnOpenExportModal').click();
      return true;
    })()`
  });
  await new Promise((r) => setTimeout(r, 600));

  const exportCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const modal = document.getElementById('exportModal');
      return JSON.stringify({
        isOpen: modal.classList.contains('open'),
        hasDownloadBtn: !!document.getElementById('btnDownloadExport'),
        hasCompressorBtn: !!document.getElementById('btnSendToCompressor')
      });
    })()`,
    returnByValue: true
  });
  console.log('4. Export Modal Status:', exportCheck.result?.value);

  // Capture Screenshot 4: Export Modal
  const ss4 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'qa-poster-studio-export-modal.png'), Buffer.from(ss4.data, 'base64'));
  console.log('Captured qa-poster-studio-export-modal.png');

  // Close modal
  await send('Runtime.evaluate', {
    expression: `(() => {
      document.getElementById('btnCloseExportModal').click();
      return true;
    })()`
  });

  console.log('Closing Chrome & Server...');
  ws.close();
  chrome.kill();
  server.close();
  console.log('QA script finished successfully!');
}

run().catch((err) => {
  console.error('QA script error:', err);
  process.exit(1);
});

