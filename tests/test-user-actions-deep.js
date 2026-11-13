// tests/test-user-actions-deep.js
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 8110;
const DEBUG_PORT = 9250;

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
    let filePath = path.join(ROOT_DIR, reqPath);

    if (!fs.existsSync(filePath)) {
      if (reqPath.startsWith('/public/blog-assets/')) {
        filePath = path.join(ROOT_DIR, reqPath.replace('/public/', ''));
      }
    }

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

  return new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(`Test server running at http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
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

  await delay(1500);

  const tabs = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)).json();
  const page = tabs.find((t) => t.type === 'page') || tabs[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));

  let idCounter = 1;
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = idCounter++;
      const timeout = setTimeout(() => {
        ws.removeEventListener('message', handler);
        reject(new Error(`CDP method ${method} timed out`));
      }, 15000);

      const handler = (evt) => {
        try {
          const res = JSON.parse(evt.data);
          if (res.id === msgId) {
            clearTimeout(timeout);
            ws.removeEventListener('message', handler);
            if (res.error) reject(res.error);
            else resolve(res.result);
          }
        } catch (_) {}
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');

  const errors = [];
  ws.addEventListener('message', (evt) => {
    try {
      const data = JSON.parse(evt.data);
      if (data.method === 'Runtime.exceptionThrown') {
        const desc = data.params?.exceptionDetails?.exception?.description || data.params?.exceptionDetails?.text;
        errors.push({ desc, line: data.params?.exceptionDetails?.lineNumber, url: data.params?.exceptionDetails?.url });
      }
    } catch (_) {}
  });

  // TEST 1: HOME PAGE WORKFLOW (Load Sample, Change Format, Convert, Download)
  console.log('\n--- 1. Testing Home Page Converter Workflow ---');
  await send('Page.navigate', { url: `http://localhost:${PORT}/` });
  await delay(1200);

  const test1 = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        const res = {};
        // 1. Click load sample
        const loadBtn = document.getElementById("loadSampleBtn");
        if (loadBtn) {
          loadBtn.click();
          res.sampleClicked = true;
        }

        await new Promise(r => setTimeout(r, 800));

        // 2. Check queue
        const queueItems = document.querySelectorAll('.queue-item');
        res.queueCount = queueItems.length;

        // 3. Select target format (PNG)
        const pngPill = document.querySelector('.format-pill[data-format="png"]');
        if (pngPill) {
          pngPill.click();
          res.selectedFormat = 'png';
        }

        // 4. Click Convert All
        const convertBtn = document.getElementById("convertAllBtn") || document.querySelector('.btn-convert-all');
        if (convertBtn) {
          convertBtn.click();
          res.convertClicked = true;
        }

        await new Promise(r => setTimeout(r, 1500));

        // 5. Check if converted status is shown
        const completedPills = document.querySelectorAll('.status-badge.completed, .badge-success, .queue-item-done');
        res.completedItems = completedPills.length;

        // 6. Test Single Download Button
        const dlBtn = document.querySelector('.btn-download, [data-action="download"]');
        res.downloadButtonFound = !!dlBtn;

        return res;
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Converter test result:', test1.result?.value);
  console.log('Errors during converter:', errors);
  errors.length = 0;

  // TEST 2: IMAGE EDITOR WORKFLOW
  console.log('\n--- 2. Testing Image Editor Workflow ---');
  await send('Page.navigate', { url: `http://localhost:${PORT}/editor/` });
  await delay(1500);

  const test2 = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        const res = {};
        // Check if editor loaded sample or has canvas
        const canvas = document.getElementById("mainCanvas");
        res.canvasPresent = !!canvas;
        res.canvasSize = canvas ? { width: canvas.width, height: canvas.height } : null;

        // Load a test image into editor if empty
        if (typeof window.loadImageFromDataUrl === 'function' || typeof window.editorState !== 'undefined') {
          res.editorStateExists = true;
        }

        // Click toolbar buttons (Crop, Filters, Adjust)
        const cropTool = document.querySelector('[data-tool="crop"]');
        if (cropTool) {
          cropTool.click();
          res.cropToolClicked = true;
        }

        const filterTab = document.querySelector('[data-tab="filters"], [data-tool="filters"]');
        if (filterTab) {
          filterTab.click();
          res.filterTabClicked = true;
        }

        // Check if export modal opens
        const exportBtn = document.getElementById("exportBtn") || document.querySelector('.btn-export');
        if (exportBtn) {
          exportBtn.click();
          res.exportBtnClicked = true;
        }

        await new Promise(r => setTimeout(r, 500));
        const exportModal = document.getElementById("exportDialog") || document.getElementById("exportModal");
        res.exportModalOpen = exportModal ? exportModal.open || !exportModal.classList.contains('hidden') : false;

        return res;
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Editor test result:', test2.result?.value);
  console.log('Errors during editor:', errors);
  errors.length = 0;

  // TEST 3: POSTER STUDIO WORKFLOW
  console.log('\n--- 3. Testing Poster Studio Workflow ---');
  await send('Page.navigate', { url: `http://localhost:${PORT}/poster-studio/` });
  await delay(1500);

  const test3 = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        const res = {};
        const canvas = document.getElementById("posterCanvas");
        res.canvasPresent = !!canvas;

        // Switch to Templates tab
        const tmplTab = document.querySelector('.rail-btn[data-tab="templates"]');
        if (tmplTab) {
          tmplTab.click();
          res.templatesTabClicked = true;
        }
        await new Promise(r => setTimeout(r, 500));

        // Click first template card
        const card = document.querySelector('.template-card');
        if (card) {
          card.click();
          res.templateLoaded = true;
        }

        // Switch to presets tab
        const presetsTab = document.querySelector('.rail-btn[data-tab="presets"]');
        if (presetsTab) {
          presetsTab.click();
          res.presetsTabClicked = true;
        }

        // Click Export
        const exportBtn = document.getElementById("btnExportPoster");
        if (exportBtn) {
          exportBtn.click();
          res.exportClicked = true;
        }
        await new Promise(r => setTimeout(r, 500));
        const modal = document.getElementById("exportPosterModal");
        res.exportModalVisible = modal ? modal.open || !modal.classList.contains('hidden') : false;

        return res;
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Poster Studio test result:', test3.result?.value);
  console.log('Errors during poster studio:', errors);
  errors.length = 0;

  // TEST 4: AI BACKGROUND REMOVER WORKFLOW
  console.log('\n--- 4. Testing AI Background Remover Workflow ---');
  await send('Page.navigate', { url: `http://localhost:${PORT}/background-remover/` });
  await delay(1500);

  const test4 = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        const res = {};
        const dropzone = document.getElementById("dropzone") || document.querySelector('.dropzone');
        res.dropzonePresent = !!dropzone;

        const sampleBtn = document.getElementById("loadSampleBtn") || document.querySelector('.btn-sample');
        if (sampleBtn) {
          sampleBtn.click();
          res.sampleClicked = true;
        }
        await new Promise(r => setTimeout(r, 1000));

        const removeBtn = document.getElementById("removeBgBtn") || document.querySelector('.btn-remove-bg');
        res.removeBtnPresent = !!removeBtn;

        return res;
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Background Remover test result:', test4.result?.value);
  console.log('Errors during BG Remover:', errors);

  console.log('\nAll workflows evaluated!');
  ws.close();
  chrome.kill();
  server.close();
}

run().catch((e) => {
  console.error('Test execution failed:', e);
  process.exit(1);
});
