// scripts/make-favicon.js
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9275;

async function makeFavicon() {
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=100,100'
  ]);

  await new Promise(r => setTimeout(r, 1200));
  const tabs = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)).json();
  const page = tabs[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let idCounter = 1;
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = idCounter++;
      const handler = (evt) => {
        const res = JSON.parse(evt.data);
        if (res.id === msgId) {
          ws.removeEventListener('message', handler);
          if (res.error) reject(res.error);
          else resolve(res.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');

  const evalRes = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');

        // Draw rounded blue square
        ctx.fillStyle = '#2563EB';
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(0, 0, 32, 32, 8);
          ctx.fill();
        } else {
          ctx.fillRect(0, 0, 32, 32);
        }

        // Draw F logo
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        // F bar
        ctx.fillRect(7, 7, 4, 18);
        ctx.fillRect(7, 7, 13, 4);
        ctx.fillRect(7, 15, 9, 3.5);

        // Orange dot
        ctx.fillStyle = '#F97316';
        ctx.beginPath();
        ctx.arc(24, 8, 3.5, 0, Math.PI * 2);
        ctx.fill();

        return canvas.toDataURL('image/png').split(',')[1];
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });

  const base64Png = evalRes.result.value;
  const pngBuf = Buffer.from(base64Png, 'base64');

  // Build ICO structure
  const icoHeader = Buffer.alloc(6);
  icoHeader.writeUInt16LE(0, 0); // reserved
  icoHeader.writeUInt16LE(1, 2); // type: 1 for icon
  icoHeader.writeUInt16LE(1, 4); // 1 image

  const dirEntry = Buffer.alloc(16);
  dirEntry.writeUInt8(32, 0); // width
  dirEntry.writeUInt8(32, 1); // height
  dirEntry.writeUInt8(0, 2);  // color count
  dirEntry.writeUInt8(0, 3);  // reserved
  dirEntry.writeUInt16LE(1, 4); // color planes
  dirEntry.writeUInt16LE(32, 6); // bpp
  dirEntry.writeUInt32LE(pngBuf.length, 8); // size of image data
  dirEntry.writeUInt32LE(22, 12); // offset

  const icoBuf = Buffer.concat([icoHeader, dirEntry, pngBuf]);

  const targetPath = path.resolve(__dirname, '..', 'favicon.ico');
  fs.writeFileSync(targetPath, icoBuf);
  console.log(`Successfully generated favicon.ico at ${targetPath} (${icoBuf.length} bytes)`);

  chrome.kill();
  process.exit(0);
}

makeFavicon().catch(err => {
  console.error(err);
  process.exit(1);
});
