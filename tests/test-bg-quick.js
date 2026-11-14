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

server.listen(8199, async () => {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new', '--remote-debugging-port=9288', '--disable-gpu', '--no-sandbox'
  ]);
  await new Promise(r => setTimeout(r, 1200));
  const tabs = await (await fetch('http://127.0.0.1:9288/json')).json();
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
  await send('Page.navigate', { url: 'http://localhost:8199/background-remover/' });
  await new Promise(r => setTimeout(r, 1000));

  const res = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        document.getElementById('btnTrySampleBg').click();
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 100));
          const card = document.getElementById('bgResultCard');
          if (card && !card.classList.contains('hidden')) {
            const canvas = document.getElementById('bgResultCanvas');
            return { success: true, width: canvas.width, height: canvas.height, timeMs: i * 100 };
          }
        }
        return { success: false };
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Background Remover Sample Test:', res.result.value);
  chrome.kill();
  server.close();
  process.exit(0);
});
