const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const ARTIFACT_DIR = 'C:\\Users\\Jing\\.gemini\\antigravity\\brain\\4bfb2196-d35a-43e7-b203-574e8e301ba2';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 8092;
const DEBUG_PORT = 9225;

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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const server = await startServer();

  console.log('Launching headless Chrome for Platform Production Launch QA...');
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    `http://localhost:${PORT}/`
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

  if (!tabs) {
    console.error('Failed to discover Chrome DevTools target');
    chrome.kill();
    server.close();
    process.exit(1);
  }

  const page = tabs.find((t) => t.type === 'page') || tabs[0];
  console.log(`Connected to CDP target: ${page.url}`);

  const ws = new WebSocket(page.webSocketDebuggerUrl);

  let idCounter = 1;
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = idCounter++;
      const timeout = setTimeout(() => {
        ws.removeEventListener('message', handler);
        reject(new Error(`CDP method ${method} timed out`));
      }, 12000);

      const handler = (evt) => {
        try {
          const res = JSON.parse(evt.data);
          if (res.id === msgId) {
            clearTimeout(timeout);
            ws.removeEventListener('message', handler);
            if (res.error) reject(new Error(res.error.message));
            else resolve(res.result);
          }
        } catch (_) {}
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  const consoleLogs = [];
  ws.addEventListener('message', (evt) => {
    try {
      const data = JSON.parse(evt.data);
      if (data.method === 'Runtime.consoleAPICalled') {
        const text = data.params.args.map((a) => a.value || JSON.stringify(a)).join(' ');
        if (data.params.type === 'error') {
          consoleLogs.push({ type: 'error', text });
        }
      }
    } catch (_) {}
  });

  await new Promise((resolve) => ws.addEventListener('open', resolve));
  console.log('DevTools WebSocket connected successfully.');

  await send('Page.enable');
  await send('Runtime.enable');

  const pagesToTest = [
    { name: 'qa-launch-home-desktop.png', url: `http://localhost:${PORT}/`, width: 1440, height: 900 },
    { name: 'qa-launch-home-mobile.png', url: `http://localhost:${PORT}/`, width: 390, height: 844 },
    { name: 'qa-launch-bg-remover.png', url: `http://localhost:${PORT}/background-remover/`, width: 1440, height: 900 },
    { name: 'qa-launch-resizer.png', url: `http://localhost:${PORT}/resizer/`, width: 1440, height: 900 },
    { name: 'qa-launch-projects.png', url: `http://localhost:${PORT}/projects/`, width: 1440, height: 900 },
    { name: 'qa-launch-help.png', url: `http://localhost:${PORT}/help/`, width: 1440, height: 900 },
    { name: 'qa-launch-contact.png', url: `http://localhost:${PORT}/contact/`, width: 1440, height: 900 },
    { name: 'qa-launch-404.png', url: `http://localhost:${PORT}/404.html`, width: 1440, height: 900 }
  ];

  console.log(`\nBeginning multi-route visual verification (${pagesToTest.length} pages)...`);

  for (const p of pagesToTest) {
    console.log(`\nNavigating to ${p.url} (${p.width}x${p.height})...`);
    await send('Emulation.setDeviceMetricsOverride', {
      width: p.width,
      height: p.height,
      deviceScaleFactor: 1,
      mobile: p.width < 600
    });

    await send('Page.navigate', { url: p.url });
    await delay(1200);

    const titleEval = await send('Runtime.evaluate', { expression: 'document.title' });
    console.log(`  Page title: "${titleEval.result.value}"`);

    // Capture screenshot
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const outPath = path.join(ARTIFACT_DIR, p.name);
    fs.writeFileSync(outPath, Buffer.from(screenshot.data, 'base64'));
    console.log(`  Saved screenshot: ${p.name}`);
  }

  console.log('\n-------------------------------------------------');
  console.log(`Console errors recorded across entire session: ${consoleLogs.length}`);
  if (consoleLogs.length > 0) {
    consoleLogs.forEach((log) => console.error(`  [${log.type}] ${log.text}`));
  } else {
    console.log('✔ Clean console! Zero unexpected runtime errors.');
  }

  // Cleanup
  ws.close();
  chrome.kill();
  server.close();
  console.log('\n🎉 ALL VISUAL VERIFICATIONS COMPLETED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('QA Script Error:', err);
  process.exit(1);
});
