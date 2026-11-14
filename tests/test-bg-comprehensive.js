const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = 'C:\\Users\\Jing\\.gemini\\antigravity\\scratch\\AppWebpConverter';
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath.endsWith('/')) reqPath += 'index.html';
  let filePath = path.join(ROOT_DIR, reqPath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200); res.end(data);
  });
});

server.listen(8193, async () => {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new', '--remote-debugging-port=9283', '--disable-gpu', '--no-sandbox'
  ]);
  await new Promise(r => setTimeout(r, 1200));
  const tabs = await (await fetch('http://127.0.0.1:9283/json')).json();
  const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let idCounter = 1;
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = idCounter++;
      const handler = (evt) => {
        const res = JSON.parse(evt.data);
        if (res.id === msgId) {
          ws.removeEventListener('message', handler);
          resolve(res.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');

  console.log('--- TEST 1: Dedicated Background Remover Page ---');
  await send('Page.navigate', { url: 'http://localhost:8193/background-remover/' });
  await new Promise(r => setTimeout(r, 1000));

  const t1 = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        document.getElementById('btnTrySampleBg').click();
        for (let i = 0; i < 50; i++) {
          await new Promise(r => setTimeout(r, 100));
          const card = document.getElementById('bgResultCard');
          if (card && !card.classList.contains('hidden')) {
            const canvas = document.getElementById('bgResultCanvas');
            const ctx = canvas.getContext('2d');
            const corner = ctx.getImageData(10, 10, 1, 1).data;
            const center = ctx.getImageData(400, 400, 1, 1).data;
            return {
              success: true,
              cornerAlpha: corner[3],
              centerAlpha: center[3],
              width: canvas.width,
              height: canvas.height
            };
          }
        }
        return { success: false, error: 'Timeout waiting for cutout' };
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Result Page Test:', t1.result.value);

  console.log('--- TEST 2: Editor Remove Background Tool ---');
  await send('Page.navigate', { url: 'http://localhost:8193/editor/' });
  await new Promise(r => setTimeout(r, 1200));

  const t2 = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        window.FluxEditor.setActiveTool('bg-remover');
        await new Promise(r => setTimeout(r, 200));
        await window.FluxEditor.triggerAiBackgroundRemoval();

        for (let i = 0; i < 50; i++) {
          await new Promise(r => setTimeout(r, 100));
          const state = window.FluxEditor.getState();
          const activeLayer = state.doc?.layers?.[0];
          if (activeLayer && activeLayer.isCutout && activeLayer.source) {
            const c = activeLayer.source;
            const ctx = c.getContext('2d');
            const corner = ctx.getImageData(10, 10, 1, 1).data;
            const mountain = ctx.getImageData(Math.floor(c.width * 0.5), Math.floor(c.height * 0.75), 1, 1).data;
            return {
              success: true,
              isCutout: activeLayer.isCutout,
              skyAlpha: corner[3],
              mountainAlpha: mountain[3]
            };
          }
        }
        return { success: false, error: 'Timeout waiting for editor cutout' };
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Editor Tool Test:', t2.result.value);

  console.log('--- TEST 3: Poster Studio Product Auto Cutout ---');
  await send('Page.navigate', { url: 'http://localhost:8193/poster-studio/' });
  await new Promise(r => setTimeout(r, 1200));

  const t3 = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        const engine = window.FluxPosterStudio?.getEngine();
        if (!engine) return { error: 'No poster studio engine' };

        // Create sample product photo with white background and red box in center
        const sampleCanvas = document.createElement('canvas');
        sampleCanvas.width = 400;
        sampleCanvas.height = 400;
        const ctx = sampleCanvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 400, 400);
        ctx.fillStyle = '#2563EB';
        ctx.fillRect(100, 100, 200, 200);

        const blob = await new Promise(r => sampleCanvas.toBlob(r, 'image/png'));
        const file = new File([blob], 'product.png', { type: 'image/png' });

        const layer = await engine.loadProductImage(file, true);
        if (!layer || !layer.imageElement) return { error: 'Failed to load product image' };

        const resCanvas = layer.imageElement;
        const resCtx = resCanvas.getContext('2d');
        const corner = resCtx.getImageData(10, 10, 1, 1).data;
        const center = resCtx.getImageData(200, 200, 1, 1).data;

        return {
          success: true,
          cornerAlpha: corner[3],
          centerAlpha: center[3]
        };
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Poster Studio Test:', t3.result.value);

  chrome.kill();
  server.close();
  process.exit(0);
});
