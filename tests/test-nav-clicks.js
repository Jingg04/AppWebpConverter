const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 8096;
const DEBUG_PORT = 9229;

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
      console.log(`Local test server running on http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const server = await startServer();

  console.log('Launching headless Chrome for Navbar interaction tests...');
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--disable-gpu',
    '--no-sandbox',
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
            if (res.error) reject(new Error(res.error.message));
            else resolve(res.result);
          }
        } catch (_) {}
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  let consoleErrors = [];
  ws.addEventListener('open', () => {
    send('Console.enable');
    send('Runtime.enable');
    send('Page.enable');
  });

  ws.addEventListener('message', (evt) => {
    const parsed = JSON.parse(evt.data);
    if (parsed.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(parsed.params.exceptionDetails);
      console.error('PAGE EXCEPTION:', parsed.params.exceptionDetails.text, parsed.params.exceptionDetails.exception?.description);
    }
  });

  await delay(2000);

  async function evaluate(code) {
    const res = await send('Runtime.evaluate', {
      expression: code,
      returnByValue: true
    });
    return res.result.value;
  }

  console.log('\n--- Checking initial state & console errors ---');
  console.log('Console errors count:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.error('FAIL: Uncaught exceptions found on page load!');
  } else {
    console.log('PASS: Zero console exceptions on page load!');
  }

  // Initial tab
  const initialActive = await evaluate(`
    document.querySelector('.nav-item.active')?.dataset.tab
  `);
  console.log('Initial active tab:', initialActive);

  const tabsToTest = [
    { tab: 'formats', viewId: 'view-formats' },
    { tab: 'history', viewId: 'view-history' },
    { tab: 'api', viewId: 'view-api' },
    { tab: 'growth', viewId: 'view-growth' },
    { tab: 'trust', viewId: 'view-trust' },
    { tab: 'converter', viewId: 'view-converter' }
  ];

  for (const { tab, viewId } of tabsToTest) {
    console.log(`\n--- Clicking Nav Tab: [${tab}] ---`);
    const clickResult = await evaluate(`
      (() => {
        const item = document.querySelector('.nav-item[data-tab="${tab}"]');
        if (!item) return { found: false };
        item.click();
        return {
          found: true,
          itemClass: item.className,
          hash: window.location.hash
        };
      })()
    `);
    console.log('Click result:', clickResult);

    await delay(300);

    const checkResult = await evaluate(`
      (() => {
        const view = document.getElementById("${viewId}");
        const activeNav = document.querySelector('.nav-item.active')?.dataset.tab;
        return {
          activeNav,
          viewFound: !!view,
          viewHasActive: view?.classList.contains('active'),
          viewHasHidden: view?.classList.contains('hidden'),
          viewDisplay: view ? window.getComputedStyle(view).display : null
        };
      })()
    `);
    console.log('Verification:', checkResult);

    if (checkResult.activeNav === tab && checkResult.viewHasActive && !checkResult.viewHasHidden && checkResult.viewDisplay === 'block') {
      console.log(`PASS: Tab [${tab}] switched successfully! View [${viewId}] is visible (display: block).`);
    } else {
      console.error(`FAIL: Tab [${tab}] did not switch correctly!`);
    }
  }

  // Also test Studio dropdown
  console.log('\n--- Testing Studio & Tools Dropdown ---');
  const dropdownTest = await evaluate(`
    (() => {
      const btn = document.getElementById('studioMenuBtn');
      const dropdown = document.getElementById('studioMenuDropdown');
      btn.click();
      return {
        isOpen: dropdown.classList.contains('show'),
        itemsCount: dropdown.querySelectorAll('.dropdown-item').length
      };
    })()
  `);
  console.log('Studio dropdown test:', dropdownTest);

  ws.close();
  chrome.kill();
  server.close();
  console.log('\nAll navigation bar interaction tests completed!');
  process.exit(consoleErrors.length > 0 ? 1 : 0);
}

run();
