// tests/test-bg-remover-sample.js
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const PORT = 8122;

const mimeTypes = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath.endsWith('/')) reqPath += 'index.html';
  let filePath = path.join(ROOT_DIR, reqPath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, async () => {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new', '--remote-debugging-port=9288', '--disable-gpu', '--no-sandbox'
  ]);
  await new Promise(r => setTimeout(r, 1500));

  const tabs = await (await fetch('http://127.0.0.1:9288/json')).json();
  const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  const send = (method, params = {}) => new Promise(res => {
    const msgId = id++;
    const handler = (evt) => {
      const data = JSON.parse(evt.data);
      if (data.id === msgId) {
        ws.removeEventListener('message', handler);
        res(data.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');

  ws.addEventListener('message', (evt) => {
    try {
      const data = JSON.parse(evt.data);
      if (data.method === 'Runtime.consoleAPICalled') {
        console.log('CONSOLE:', data.params.type, data.params.args.map(a => a.value || a.description).join(' '));
      }
      if (data.method === 'Runtime.exceptionThrown') {
        console.error('EXCEPTION:', data.params.exceptionDetails?.exception?.description || data.params.exceptionDetails?.text);
      }
    } catch (_) {}
  });

  await send('Page.navigate', { url: `http://localhost:${PORT}/background-remover/` });
  await new Promise(r => setTimeout(r, 1500));

  // Click Try Sample Photo
  const clickRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = document.getElementById('btnTrySampleBg');
        if (btn) {
          btn.click();
          return { clicked: true };
        }
        return { clicked: false };
      })()
    `,
    returnByValue: true
  });
  console.log('Sample button clicked:', clickRes.result?.value);

  // Wait for AI processing
  await new Promise(r => setTimeout(r, 4000));

  const status = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const resultCard = document.getElementById('bgResultCard');
        const processingCard = document.getElementById('bgProcessingCard');
        const statusText = document.getElementById('bgStatusText');
        const canvas = document.getElementById('bgResultCanvas');
        return {
          resultCardVisible: !resultCard.classList.contains('hidden'),
          processingCardVisible: !processingCard.classList.contains('hidden'),
          statusText: statusText?.textContent,
          canvasWidth: canvas ? canvas.width : 0,
          canvasHeight: canvas ? canvas.height : 0
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Background Remover result status:', status.result?.value);

  ws.close();
  chrome.kill();
  server.close();
});
