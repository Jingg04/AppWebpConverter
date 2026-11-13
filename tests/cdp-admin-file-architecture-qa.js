// tests/cdp-admin-file-architecture-qa.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8102;

// Simple local server supporting API endpoints and static files
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  
  if (url.pathname.startsWith('/api/admin/auth')) {
    const handler = require('../api/admin/auth.js');
    return handler(req, res);
  }
  if (url.pathname.startsWith('/api/admin/content')) {
    const handler = require('../api/admin/content.js');
    return handler(req, res);
  }
  if (url.pathname.startsWith('/api/admin/backup')) {
    const handler = require('../api/admin/backup.js');
    return handler(req, res);
  }

  // Rewrite /samnang.com.com.omg/(.*) to /samnang.com.com.omg/index.html
  let filePath = '';
  if (url.pathname.startsWith('/samnang.com.com.omg')) {
    if (url.pathname.endsWith('.css') || url.pathname.endsWith('.js') || url.pathname.endsWith('.svg') || url.pathname.endsWith('.png')) {
      filePath = path.join(ROOT, url.pathname);
    } else {
      filePath = path.join(ROOT, 'samnang.com.com.omg/index.html');
    }
  } else {
    filePath = path.join(ROOT, url.pathname === '/' ? 'index.html' : url.pathname);
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.webp': 'image/webp'
    };
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, async () => {
  console.log(`Local test server running at http://localhost:${PORT}`);

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chromeProcess = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9226',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,900'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const listRes = await fetch('http://localhost:9226/json');
    const tabs = await listRes.json();
    const wsUrl = tabs[0].webSocketDebuggerUrl;

    const ws = new WebSocket(wsUrl);

    let id = 1;
    const pending = new Map();

    function send(method, params = {}) {
      return new Promise((resolve) => {
        const msgId = id++;
        pending.set(msgId, resolve);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    ws.onmessage = (evt) => {
      const data = JSON.parse(evt.data);
      if (pending.has(data.id)) {
        const res = pending.get(data.id);
        pending.delete(data.id);
        res(data.result);
      }
    };

    if (ws.readyState !== 1) {
      await new Promise(r => ws.onopen = r);
    }

    await send('Page.enable');
    await send('Runtime.enable');

    // 1. Visit admin login gate
    await send('Page.navigate', { url: `http://localhost:${PORT}/samnang.com.com.omg` });
    await new Promise(r => setTimeout(r, 1200));

    // Submit password via form
    await send('Runtime.evaluate', {
      expression: `
        document.getElementById('adminPassword').value = 'fluxwebp2026!pro';
        document.getElementById('loginForm').dispatchEvent(new Event('submit'));
      `
    });
    await new Promise(r => setTimeout(r, 1500));

    // 2. Capture Media Directory Panel
    await send('Runtime.evaluate', {
      expression: `
        document.querySelector('.admin-nav-item[data-panel="media"]').click();
      `
    });
    await new Promise(r => setTimeout(r, 1500));

    const mediaShot = await send('Page.captureScreenshot', { format: 'png' });
    const artifactDir = 'C:/Users/Jing/.gemini/antigravity/brain/4bfb2196-d35a-43e7-b203-574e8e301ba2';
    fs.writeFileSync(path.join(artifactDir, 'qa-admin-media-file-architecture.png'), Buffer.from(mediaShot.data, 'base64'));
    console.log('Saved qa-admin-media-file-architecture.png');

    // 3. Capture Settings & Backup/Restore Panel
    await send('Runtime.evaluate', {
      expression: `
        document.querySelector('.admin-nav-item[data-panel="settings"]').click();
      `
    });
    await new Promise(r => setTimeout(r, 1200));

    const settingsShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'qa-admin-backup-restore.png'), Buffer.from(settingsShot.data, 'base64'));
    console.log('Saved qa-admin-backup-restore.png');

    console.log('Admin CDP Visual Verification Completed Successfully!');
    ws.close();
  } catch (err) {
    console.error('CDP Error:', err);
  } finally {
    chromeProcess.kill();
    server.close();
  }
});
