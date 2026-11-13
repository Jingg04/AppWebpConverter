const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\Jing\\.gemini\\antigravity\\brain\\4bfb2196-d35a-43e7-b203-574e8e301ba2';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function run() {
  console.log('Launching headless Chrome for Editor QA...');
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--window-size=1920,1080',
    'http://localhost:8088/editor/'
  ]);

  chrome.on('error', (err) => console.error('Chrome process error:', err));

  let tabs = null;
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 600));
    try {
      tabs = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:9222/json', (res) => {
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
      }, 10000);

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

  // 1. Initial State Check
  const eval1 = await send('Runtime.evaluate', {
    expression: `(() => {
      try {
        return JSON.stringify({
          title: document.title,
          hasHeader: !!document.querySelector('.editor-header'),
          hasTools: !!document.querySelector('.editor-primary-tools'),
          hasCanvas: !!document.getElementById('editorCanvas'),
          emptyOverlayVisible: !document.getElementById('editorEmptyOverlay').classList.contains('hidden')
        });
      } catch (e) {
        return JSON.stringify({ error: e.message });
      }
    })()`,
    returnByValue: true
  });
  console.log('1. Initial DOM Verification:', eval1.result?.value);

  // Capture Desktop Empty Landing State
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false
  });
  await new Promise((r) => setTimeout(r, 400));
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  const desktopLandingPath = path.join(ARTIFACT_DIR, 'qa-editor-desktop-1920.png');
  fs.writeFileSync(desktopLandingPath, Buffer.from(shot1.data, 'base64'));
  console.log(`Saved initial landing screenshot: ${desktopLandingPath}`);

  // 2. Click Sample Landscape Button
  console.log('2. Clicking "Sample Landscape" button...');
  await send('Runtime.evaluate', {
    expression: `
      const btn = document.getElementById('loadSampleLandscapeBtn');
      if (btn) btn.click();
    `
  });

  await new Promise((r) => setTimeout(r, 1200));

  const eval2 = await send('Runtime.evaluate', {
    expression: `(() => {
      try {
        const state = window.FluxEditor?.getState();
        return JSON.stringify({
          emptyOverlayHidden: document.getElementById('editorEmptyOverlay').classList.contains('hidden'),
          docDimensions: document.getElementById('canvasDimText')?.textContent,
          zoomLevel: document.getElementById('zoomLevelDisplay')?.textContent,
          layersCount: state?.doc?.layers?.length || 0,
          activeLayerName: state?.doc?.layers?.find(l => l.id === state.doc.activeLayerId)?.name,
          canvasWidth: document.getElementById('editorCanvas')?.width,
          canvasHeight: document.getElementById('editorCanvas')?.height
        });
      } catch (e) {
        return JSON.stringify({ error: e.message });
      }
    })()`,
    returnByValue: true
  });
  console.log('2. State After Photo Load:', eval2.result?.value);

  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  const photoPath = path.join(ARTIFACT_DIR, 'qa-editor-with-photo.png');
  fs.writeFileSync(photoPath, Buffer.from(shot2.data, 'base64'));
  console.log(`Saved editor with photo screenshot: ${photoPath}`);

  // 3. Switch to Adjustments tab and apply preset + slider
  console.log('3. Switching to Adjustments tab & applying Vivid preset...');
  await send('Runtime.evaluate', {
    expression: `
      const adjTab = document.querySelector('.tool-icon-btn[data-tool="adjust"]');
      if (adjTab) adjTab.click();
      const vividPreset = document.querySelector('.preset-pill[data-preset="vivid"]');
      if (vividPreset) vividPreset.click();
    `
  });

  await new Promise((r) => setTimeout(r, 600));

  const eval3 = await send('Runtime.evaluate', {
    expression: `(() => {
      try {
        const state = window.FluxEditor?.getState();
        const activeLayer = state?.doc?.layers?.find(l => l.id === state.doc.activeLayerId);
        return JSON.stringify({
          activeTool: state?.activeTool,
          preset: activeLayer?.filters?.preset,
          brightness: activeLayer?.filters?.brightness,
          contrast: activeLayer?.filters?.contrast,
          saturation: activeLayer?.filters?.saturation
        });
      } catch (e) {
        return JSON.stringify({ error: e.message });
      }
    })()`,
    returnByValue: true
  });
  console.log('3. Adjustments Applied:', eval3.result?.value);

  const shot3 = await send('Page.captureScreenshot', { format: 'png' });
  const adjPath = path.join(ARTIFACT_DIR, 'qa-editor-adjustments.png');
  fs.writeFileSync(adjPath, Buffer.from(shot3.data, 'base64'));
  console.log(`Saved adjustments screenshot: ${adjPath}`);

  // 4. Test Mobile Responsive Viewport (390 x 844)
  console.log('4. Testing Mobile Viewport (390x844)...');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await new Promise((r) => setTimeout(r, 800));

  const eval4 = await send('Runtime.evaluate', {
    expression: `(() => {
      try {
        return JSON.stringify({
          viewportW: window.innerWidth,
          bodyScrollW: document.body.scrollWidth,
          mobileBarDisplay: window.getComputedStyle(document.getElementById('mobileBottomBar')).display,
          paletteDisplay: window.getComputedStyle(document.querySelector('.editor-primary-tools')).display,
          canvasVisible: !!document.getElementById('editorCanvas')
        });
      } catch (e) {
        return JSON.stringify({ error: e.message });
      }
    })()`,
    returnByValue: true
  });
  console.log('4. Mobile Layout Verification:', eval4.result?.value);

  const shot4 = await send('Page.captureScreenshot', { format: 'png' });
  const mobilePath = path.join(ARTIFACT_DIR, 'qa-editor-mobile-390.png');
  fs.writeFileSync(mobilePath, Buffer.from(shot4.data, 'base64'));
  console.log(`Saved mobile screenshot: ${mobilePath}`);

  ws.close();
  chrome.kill();
  console.log('All QA steps completed successfully!');
}

run().catch((err) => {
  console.error('CDP QA Error:', err);
  process.exit(1);
});
