const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const ARTIFACT_DIR = 'C:\\Users\\Jing\\.gemini\\antigravity\\brain\\4bfb2196-d35a-43e7-b203-574e8e301ba2';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 8094;
const DEBUG_PORT = 9227;

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
        res.end('Not found: ' + filePath);
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
      console.log(`QA test server running on http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const server = await startServer();

  console.log('Launching headless Chrome for Blog & CMS QA...');
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    `http://localhost:${PORT}/blog/`
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
    console.error('Failed to discover Chrome target');
    chrome.kill();
    server.close();
    process.exit(1);
  }

  const page = tabs.find((t) => t.type === 'page') || tabs[0];
  console.log(`Connected to CDP: ${page.url}`);
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
            if (res.error) reject(new Error(res.error.message));
            else resolve(res.result);
          }
        } catch (_) {}
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  await new Promise((resolve) => ws.addEventListener('open', resolve));
  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');

  async function capture(filename, clip = null) {
    const res = await send('Page.captureScreenshot', {
      format: 'png',
      ...(clip ? { clip } : {})
    });
    const dest = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(dest, Buffer.from(res.data, 'base64'));
    console.log(`Saved screenshot: ${dest}`);
  }

  async function navigate(url) {
    await send('Page.navigate', { url });
    await delay(1200);
  }

  try {
    // 1. Blog Index Desktop
    console.log('\n--- Capturing Blog Index (Desktop) ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 960,
      deviceScaleFactor: 1,
      mobile: false
    });
    await navigate(`http://localhost:${PORT}/blog/`);
    await delay(1000);
    await capture('qa-blog-index-desktop.png');

    // 2. Blog Index Mobile
    console.log('\n--- Capturing Blog Index (Mobile) ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await navigate(`http://localhost:${PORT}/blog/`);
    await delay(1000);
    await capture('qa-blog-index-mobile.png');

    // 3. Blog Article Static View
    console.log('\n--- Capturing Blog Article Static View ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 960,
      deviceScaleFactor: 1,
      mobile: false
    });
    await navigate(`http://localhost:${PORT}/blog/what-is-webp-how-it-works/`);
    await delay(1000);
    await capture('qa-blog-article-view.png');

    // 4. Admin Login Gate Screen
    console.log('\n--- Capturing Admin Login Gate ---');
    await navigate(`http://localhost:${PORT}/samnang.com.com.omg/`);
    await delay(600);
    await capture('qa-admin-login-gate.png');

    // 5. Admin Dashboard (Logged in)
    console.log('\n--- Authenticating Admin and Capturing Dashboard ---');
    await send('Runtime.evaluate', {
      expression: `
        document.getElementById('adminPassword').value = 'fluxwebp2026!pro';
        document.getElementById('loginForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      `
    });
    await delay(2500);
    await capture('qa-admin-dashboard.png');

    // 6. Admin Visual Asset Manager Tab
    console.log('\n--- Capturing Admin Visual Asset Manager ---');
    await send('Runtime.evaluate', {
      expression: `
        if (typeof window.switchPanel === 'function') {
          window.switchPanel('visual-assets');
        }
      `
    });
    await delay(1800);
    await capture('qa-admin-visual-assets.png');

    console.log('\nAll Blog & CMS visual QA screenshots captured successfully!');
  } catch (err) {
    console.error('QA run error:', err);
  } finally {
    ws.close();
    chrome.kill();
    server.close();
    process.exit(0);
  }
}

run();
