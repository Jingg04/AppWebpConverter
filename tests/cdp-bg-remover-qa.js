const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const ARTIFACT_DIR = 'C:\\Users\\Jing\\.gemini\\antigravity\\brain\\4bfb2196-d35a-43e7-b203-574e8e301ba2';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 8089;
const DEBUG_PORT = 9223;

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

  console.log('Launching headless Chrome for AI Background Remover QA...');
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--window-size=1920,1080',
    `http://localhost:${PORT}/editor/`
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

  const page = tabs.find((t) => t.type === 'page' && t.url.includes('editor')) || tabs[0];
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

  // Step 1: Verify buttons exist in UI
  const uiCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      return JSON.stringify({
        hasHeaderBtn: !!document.getElementById('btnHeaderRemoveBg'),
        hasToolBtn: !!document.getElementById('toolBtnBgRemover'),
        hasSubpanel: !!document.getElementById('subpanelBgRemover'),
        hasRefineModal: !!document.getElementById('refinementModal'),
        hasBatchModal: !!document.getElementById('batchBgModal'),
        hasSampleCutoutBtn: !!document.getElementById('loadSampleCutoutBtn'),
        engineDefined: typeof window.FluxBgRemover !== 'undefined'
      });
    })()`,
    returnByValue: true
  });
  console.log('1. UI Elements Verification:', uiCheck.result?.value);

  // Step 2: Click "Load Sample Portrait" to initialize a test image
  console.log('2. Loading sample portrait with cutout subject...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.getElementById('loadSampleCutoutBtn');
      if (btn) btn.click();
      return true;
    })()`
  });
  await new Promise((r) => setTimeout(r, 1000));

  // Switch to Cutout tool
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.FluxEditor.setActiveTool('bg-remover');
      return true;
    })()`
  });
  await new Promise((r) => setTimeout(r, 500));

  // Step 3: Trigger AI Background Removal
  console.log('3. Triggering AI Background Removal on sample portrait...');
  const bgRemoveResult = await send('Runtime.evaluate', {
    expression: `(async () => {
      try {
        await window.FluxEditor.triggerAiBackgroundRemoval();
        const activeLayer = window.FluxEditor.getActiveLayer();
        return JSON.stringify({
          success: true,
          hasMask: !!activeLayer.maskCanvas,
          isCutout: !!activeLayer.isCutout,
          layerName: activeLayer.name,
          layerWidth: activeLayer.width,
          layerHeight: activeLayer.height
        });
      } catch (e) {
        return JSON.stringify({ success: false, error: e.message });
      }
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('3. Background Removal Execution:', bgRemoveResult.result?.value);

  // Screenshot 1: Background Removed (Transparent Cutout on Checkerboard)
  const ss1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'qa-bg-removed.png'), Buffer.from(ss1.data, 'base64'));
  console.log('Captured qa-bg-removed.png');

  // Step 4: Open Refinement Studio
  console.log('4. Opening Refinement Studio...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.FluxEditor.openRefinementStudio();
      return true;
    })()`
  });
  await new Promise((r) => setTimeout(r, 800));

  // Switch to Ruby Mask view mode in Refinement Studio
  await send('Runtime.evaluate', {
    expression: `(() => {
      const rubyBtn = document.querySelector('.view-tab[data-view="ruby"]');
      if (rubyBtn) rubyBtn.click();
      return true;
    })()`
  });
  await new Promise((r) => setTimeout(r, 600));

  const refineCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const modal = document.getElementById('refinementModal');
      const canvas = document.getElementById('refinementCanvas');
      return JSON.stringify({
        isModalOpen: !modal.classList.contains('hidden'),
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        viewModeButtons: document.querySelectorAll('.view-tab').length
      });
    })()`,
    returnByValue: true
  });
  console.log('4. Refinement Studio Status (Ruby Mask view):', refineCheck.result?.value);

  // Screenshot 2: Refinement Studio
  const ss2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'qa-refinement-studio.png'), Buffer.from(ss2.data, 'base64'));
  console.log('Captured qa-refinement-studio.png');

  // Close Refinement Studio (Apply Cutout)
  await send('Runtime.evaluate', {
    expression: `(() => {
      const applyBtn = document.getElementById('refineApplyBtn');
      if (applyBtn) applyBtn.click();
      return true;
    })()`
  });
  await new Promise((r) => setTimeout(r, 600));

  // Step 5: Test Background Replacement (Studio Gradient)
  console.log('5. Applying Studio Gradient background replacement...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.FluxEditor.setActiveTool('bg-remover');
      const sunsetBtn = document.querySelector('[data-gradient="sunset-warmth"]');
      if (sunsetBtn) sunsetBtn.click();
      return true;
    })()`
  });
  await new Promise((r) => setTimeout(r, 800));

  // Verify layer has bgType set
  const bgTypeCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const layer = window.FluxEditor.getActiveLayer();
      return JSON.stringify({
        bgType: layer.bgType,
        bgGradient: layer.bgGradient,
        hasCanvas: !!document.getElementById('editorCanvas')
      });
    })()`,
    returnByValue: true
  });
  console.log('5. Background Replacement Check:', bgTypeCheck.result?.value);

  // Screenshot 3: Replaced Studio Gradient Background
  const ss3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'qa-replaced-bg.png'), Buffer.from(ss3.data, 'base64'));
  console.log('Captured qa-replaced-bg.png');

  // Step 6: Test Batch BG Dialog Opening
  console.log('6. Opening Batch Background Removal Dialog...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.getElementById('btnOpenBatchBgModal');
      if (btn) btn.click();
      return true;
    })()`
  });
  await new Promise((r) => setTimeout(r, 600));

  const batchCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const modal = document.getElementById('batchBgModal');
      return JSON.stringify({
        isBatchModalOpen: !modal.classList.contains('hidden'),
        hasDropZone: !!document.getElementById('batchBgDropzone'),
        hasStartBtn: !!document.getElementById('btnStartBatchBg'),
        hasZipBtn: !!document.getElementById('btnDownloadBatchBgZip')
      });
    })()`,
    returnByValue: true
  });
  console.log('6. Batch Modal Check:', batchCheck.result?.value);

  // Screenshot 4: Batch Background Remover Dialog
  const ss4 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'qa-batch-bg-dialog.png'), Buffer.from(ss4.data, 'base64'));
  console.log('Captured qa-batch-bg-dialog.png');

  // Close batch modal
  await send('Runtime.evaluate', {
    expression: `(() => {
      const closeBtn = document.getElementById('btnCloseBatchBg');
      if (closeBtn) closeBtn.click();
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
