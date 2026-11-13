// tests/diagnose-everything.js
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 8098;
const DEBUG_PORT = 9235;

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
      console.log(`Local test server running on http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const server = await startServer();

  console.log('Launching headless Chrome for Full Diagnostic Testing...');
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,900'
  ]);

  let tabs = null;
  for (let i = 0; i < 20; i++) {
    await delay(500);
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

  const page = tabs.find((t) => t.type === 'page') || tabs[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);

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

  if (ws.readyState !== 1) {
    await new Promise((r) => (ws.onopen = r));
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');

  const errors = [];
  ws.addEventListener('message', (evt) => {
    try {
      const data = JSON.parse(evt.data);
      if (data.method === 'Runtime.exceptionThrown') {
        const desc = data.params?.exceptionDetails?.exception?.description || data.params?.exceptionDetails?.text;
        errors.push({ type: 'exception', desc, url: data.params?.exceptionDetails?.url, line: data.params?.exceptionDetails?.lineNumber });
      }
      if (data.method === 'Log.entryAdded' && data.params?.entry?.level === 'error') {
        errors.push({ type: 'log-error', text: data.params?.entry?.text });
      }
    } catch (_) {}
  });

  const testUrls = [
    `http://localhost:${PORT}/`,
    `http://localhost:${PORT}/editor/`,
    `http://localhost:${PORT}/background-remover/`,
    `http://localhost:${PORT}/poster-studio/`,
    `http://localhost:${PORT}/resizer/`,
    `http://localhost:${PORT}/projects/`,
    `http://localhost:${PORT}/blog/`,
    `http://localhost:${PORT}/samnang.com.com.omg/`
  ];

  console.log('\n==========================================================');
  console.log(' STEP 1: AUDITING LOCAL APP ROUTES FOR RUNTIME CRASHES');
  console.log('==========================================================');

  for (const url of testUrls) {
    errors.length = 0;
    console.log(`\nNavigating to: ${url}`);
    await send('Page.navigate', { url });
    await delay(1500);

    const readyState = await send('Runtime.evaluate', { expression: 'document.readyState' });
    console.log(`  ReadyState: ${readyState.result?.value}`);
    console.log(`  Errors count: ${errors.length}`);
    if (errors.length > 0) {
      errors.forEach((e) => console.log('    -> ERROR:', JSON.stringify(e)));
    } else {
      console.log('  [PASS] Zero runtime exceptions on load');
    }
  }

  // STEP 2: TEST ACTIONS ON HOME CONVERTER
  console.log('\n==========================================================');
  console.log(' STEP 2: TESTING CORE USER ACTIONS ON HOME PAGE');
  console.log('==========================================================');
  await send('Page.navigate', { url: `http://localhost:${PORT}/` });
  await delay(1200);

  // Test load sample image
  const sampleTest = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = document.getElementById("loadSampleBtn");
        if (!btn) return { error: "loadSampleBtn not found" };
        btn.click();
        return {
          clicked: true,
          queueCount: document.querySelectorAll('.queue-item').length,
          previewVisible: !document.getElementById('previewStage')?.classList.contains('hidden')
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Sample Image Action:', sampleTest.result?.value);
  await delay(1500);

  const sampleResultAfter = await send('Runtime.evaluate', {
    expression: `
      (() => {
        return {
          queueItems: document.querySelectorAll('.queue-item').length,
          hasErrors: document.querySelectorAll('.error, .alert-danger').length,
          stateQueueLen: window.FluxState?.queue?.length || state?.queue?.length || "unknown"
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Queue state after sample:', sampleResultAfter.result?.value);

  // STEP 3: AUDIT LIVE VERCEL PRODUCTION (CACHE & ERRORS)
  console.log('\n==========================================================');
  console.log(' STEP 3: TESTING LIVE VERCEL DEPLOYMENT FOR ERRORS');
  console.log('==========================================================');
  const liveUrls = [
    'https://app-webp-converter.vercel.app/',
    'https://app-webp-converter.vercel.app/editor/',
    'https://app-webp-converter.vercel.app/background-remover/',
    'https://app-webp-converter.vercel.app/poster-studio/'
  ];

  for (const url of liveUrls) {
    errors.length = 0;
    console.log(`\nNavigating to LIVE: ${url}`);
    await send('Page.navigate', { url });
    await delay(2000);

    console.log(`  Live Errors count: ${errors.length}`);
    if (errors.length > 0) {
      errors.forEach((e) => console.log('    -> LIVE ERROR:', JSON.stringify(e)));
    } else {
      console.log('  [PASS] Zero runtime exceptions on live page');
    }
  }

  console.log('\nDiagnostic Complete!');
  ws.close();
  chrome.kill();
  server.close();
}

run().catch((err) => {
  console.error('Diagnostic error:', err);
  process.exit(1);
});
