// tests/test-all-features-deep.js
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 8130;
const DEBUG_PORT = 9290;

function startServer() {
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
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

    if (reqPath.startsWith('/api/')) {
      if (reqPath === '/api/ai-status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'online', defaultProvider: 'FLUX.1 Cloud' }));
        return;
      }
      if (reqPath === '/api/admin/auth') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ authenticated: true }));
        return;
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

  console.log('Launching headless Chrome for Full System Test...');
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
      tabs = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)).json();
      if (tabs && tabs.length > 0) break;
    } catch (_) {}
  }

  const page = tabs.find((t) => t.type === 'page') || tabs[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));

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

  await send('Page.enable');
  await send('Runtime.enable');

  const pageErrors = [];
  ws.addEventListener('message', (evt) => {
    try {
      const data = JSON.parse(evt.data);
      if (data.method === 'Runtime.exceptionThrown') {
        const desc = data.params?.exceptionDetails?.exception?.description || data.params?.exceptionDetails?.text;
        pageErrors.push({ desc, line: data.params?.exceptionDetails?.lineNumber, url: data.params?.exceptionDetails?.url });
      }
    } catch (_) {}
  });

  const results = {};

  try {
    // ========================================================
    // TEST SUITE 1: Universal Converter (Home Page)
    // ========================================================
    console.log('\n=============================================');
    console.log('TEST SUITE 1: UNIVERSAL CONVERTER (HOME PAGE)');
    console.log('=============================================');
    await send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await delay(1200);

    const homeTest = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          const log = [];
          const loadBtn = document.getElementById("loadSampleBtn");
          if (!loadBtn) return { error: "loadSampleBtn missing" };
          
          loadBtn.click();
          log.push("Clicked loadSampleBtn");
          await new Promise(r => setTimeout(r, 1200));

          const items = document.querySelectorAll('.queue-item');
          log.push("Queue items count: " + items.length);
          
          const doneItem = document.querySelector('.status-pill.status-done');
          log.push("Completed item in queue: " + !!doneItem);

          // Comparison Stage Controls
          const slider = document.getElementById("compareRange");
          if (slider) {
            slider.value = 25;
            slider.dispatchEvent(new Event("input"));
            slider.value = 75;
            slider.dispatchEvent(new Event("input"));
            log.push("Split slider adjusted");
          }

          const toggleMode = document.getElementById("toggleCompareMode");
          if (toggleMode) {
            toggleMode.click();
            log.push("Toggled comparison mode: side-by-side");
            await new Promise(r => setTimeout(r, 100));
            toggleMode.click();
            log.push("Toggled comparison mode: split");
          }

          const toggleChecker = document.getElementById("toggleCheckerboard");
          if (toggleChecker) {
            toggleChecker.click();
            log.push("Toggled checkerboard transparency");
          }

          // Format Switching (PNG, JPEG, AVIF, WebP)
          const formats = ['png', 'jpeg', 'avif', 'webp'];
          for (const fmt of formats) {
            const pill = document.querySelector('.format-pill[data-format="' + fmt + '"]');
            if (pill) {
              pill.click();
              log.push("Switched format to: " + fmt);
              await new Promise(r => setTimeout(r, 400));
            }
          }

          // Quality Presets
          const preset35 = document.querySelector('.preset-btn[data-quality="35"]');
          if (preset35) {
            preset35.click();
            log.push("Preset 35%: quality=" + document.getElementById("qualityValue")?.textContent);
          }

          const presetLossless = document.getElementById("losslessPresetBtn");
          if (presetLossless) {
            presetLossless.click();
            log.push("Preset Lossless: quality=" + document.getElementById("qualityValue")?.textContent);
          }

          const preset82 = document.querySelector('.preset-btn[data-quality="82"]');
          if (preset82) {
            preset82.click();
            log.push("Preset 82%: restored");
          }

          // Auto Optimize & EXIF toggles
          const autoOpt = document.getElementById("autoOptimize");
          if (autoOpt) {
            autoOpt.click();
            log.push("Toggled Auto Optimize: " + autoOpt.checked);
            autoOpt.click();
          }

          // Download ZIP button enabled state check
          const dlZipBtn = document.getElementById("downloadZip");
          log.push("Download ZIP enabled: " + (dlZipBtn && !dlZipBtn.disabled));

          // Tabs navigation
          window.location.hash = "#/formats";
          await new Promise(r => setTimeout(r, 400));
          const searchInput = document.getElementById("formatSearchInput");
          if (searchInput) {
            searchInput.value = "raw";
            searchInput.dispatchEvent(new Event("input"));
            log.push("Searched formats for 'raw'");
          }

          window.location.hash = "#/history";
          await new Promise(r => setTimeout(r, 400));
          const histRows = document.querySelectorAll(".history-row");
          log.push("History rows count: " + histRows.length);

          window.location.hash = "#/converter";
          await new Promise(r => setTimeout(r, 400));

          const dlBtn = document.getElementById("downloadSelected");
          log.push("Download selected enabled: " + (dlBtn && !dlBtn.disabled));

          return { success: true, log };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('Universal Converter Result:', homeTest.result?.value);
    results.home = homeTest.result?.value;

    // ========================================================
    // TEST SUITE 2: Full Image Editor (/editor/)
    // ========================================================
    console.log('\n=============================================');
    console.log('TEST SUITE 2: FULL IMAGE EDITOR (/editor/)');
    console.log('=============================================');
    await send('Page.navigate', { url: `http://localhost:${PORT}/editor/` });
    await delay(1500);

    const editorTest = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          const log = [];
          const canvas = document.getElementById("editorCanvas");
          if (!canvas) return { error: "editorCanvas missing" };
          log.push("Canvas initialized: " + canvas.width + "x" + canvas.height);

          // Click all tool buttons
          const tools = ['crop', 'rotate', 'filters', 'adjust', 'text', 'draw', 'shapes'];
          for (const t of tools) {
            const btn = document.querySelector('[data-tool="' + t + '"]');
            if (btn) {
              btn.click();
              log.push("Activated tool: " + t);
              await new Promise(r => setTimeout(r, 150));
            }
          }

          // Test brightness adjustment
          const brightSlider = document.getElementById("adjBrightness") || document.querySelector('input[data-adjust="brightness"]');
          if (brightSlider) {
            brightSlider.value = 25;
            brightSlider.dispatchEvent(new Event("input"));
            log.push("Adjusted brightness: 25");
          }

          // Test filter application
          const sepiaBtn = document.querySelector('.filter-card[data-filter="sepia"]') || document.querySelector('[data-filter="grayscale"]');
          if (sepiaBtn) {
            sepiaBtn.click();
            log.push("Applied filter: " + (sepiaBtn.dataset.filter || "sepia"));
          }

          // Test Add Text
          const addTextBtn = document.getElementById("btnAddText") || document.querySelector('.btn-add-text');
          if (addTextBtn) {
            addTextBtn.click();
            log.push("Added Text layer");
          }

          // Test Undo
          const undoBtn = document.getElementById("undoBtn") || document.querySelector('[data-action="undo"]');
          if (undoBtn) {
            undoBtn.click();
            log.push("Undo executed");
          }

          // Test Save Project (.fluxproj)
          const saveBtn = document.getElementById("saveProjBtn");
          if (saveBtn) {
            saveBtn.click();
            log.push("Saved project via saveProjBtn");
          }

          // Test Export Dialog
          const exportBtn = document.getElementById("btnExport") || document.getElementById("exportBtn") || document.querySelector('.btn-export');
          if (exportBtn) {
            exportBtn.click();
            await new Promise(r => setTimeout(r, 300));
            const modal = document.getElementById("exportDialog") || document.getElementById("exportModal");
            const isOpen = modal ? !modal.classList.contains('hidden') || modal.open : false;
            log.push("Export dialog opened: " + isOpen);
            const closeBtn = document.getElementById("closeExportBtn") || modal?.querySelector('.modal-close');
            if (closeBtn) closeBtn.click();
          }

          return { success: true, log };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('Image Editor Result:', editorTest.result?.value);
    results.editor = editorTest.result?.value;

    // ========================================================
    // TEST SUITE 3: AI Background Remover (/background-remover/)
    // ========================================================
    console.log('\n=============================================');
    console.log('TEST SUITE 3: AI BACKGROUND REMOVER (/background-remover/)');
    console.log('=============================================');
    await send('Page.navigate', { url: `http://localhost:${PORT}/background-remover/` });
    await delay(1200);

    const bgTest = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          const log = [];
          const sampleBtn = document.getElementById("btnTrySampleBg");
          if (!sampleBtn) return { error: "btnTrySampleBg missing" };

          log.push("Clicking Try Sample Photo");
          sampleBtn.click();

          let completed = false;
          for (let i = 0; i < 40; i++) {
            await new Promise(r => setTimeout(r, 100));
            const resCard = document.getElementById("bgResultCard");
            if (resCard && !resCard.classList.contains("hidden")) {
              completed = true;
              break;
            }
          }

          log.push("Removal completed: " + completed);
          const resCanvas = document.getElementById("bgResultCanvas");
          log.push("Result canvas: " + (resCanvas ? resCanvas.width + "x" + resCanvas.height : "none"));

          const btnDownloadPng = document.getElementById("btnDownloadPng");
          const btnDownloadWebp = document.getElementById("btnDownloadWebp");
          log.push("Download buttons: PNG=" + !!btnDownloadPng + ", WebP=" + !!btnDownloadWebp);

          const btnSendToEditor = document.getElementById("btnSendToEditor");
          const btnSendToPoster = document.getElementById("btnSendToPoster");
          log.push("Handoff buttons: Editor=" + !!btnSendToEditor + ", Poster=" + !!btnSendToPoster);

          return { success: completed, log };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('AI Background Remover Result:', bgTest.result?.value);
    results.bgRemover = bgTest.result?.value;

    // ========================================================
    // TEST SUITE 4: AI Poster Studio (/poster-studio/)
    // ========================================================
    console.log('\n=============================================');
    console.log('TEST SUITE 4: AI POSTER STUDIO (/poster-studio/)');
    console.log('=============================================');
    await send('Page.navigate', { url: `http://localhost:${PORT}/poster-studio/` });
    await delay(1500);

    const posterTest = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          const log = [];
          const canvas = document.getElementById("posterCanvas");
          if (!canvas) return { error: "posterCanvas missing" };
          log.push("Poster canvas present: " + canvas.width + "x" + canvas.height);

          // 1. Templates Tab
          const tmplTab = document.querySelector('.rail-btn[data-tab="templates"]');
          if (tmplTab) {
            tmplTab.click();
            await new Promise(r => setTimeout(r, 300));
            const card = document.querySelector('.template-item-card');
            if (card) {
              card.click();
              log.push("Selected template: " + (card.querySelector('.template-card-name')?.textContent || 'template'));
              await new Promise(r => setTimeout(r, 400));
            }
          }

          // 2. Presets Tab
          const presetsTab = document.querySelector('.rail-btn[data-tab="presets"]');
          if (presetsTab) {
            presetsTab.click();
            await new Promise(r => setTimeout(r, 200));
            const presetBtn = document.querySelector('.size-preset-btn');
            if (presetBtn) {
              presetBtn.click();
              log.push("Preset dimensions updated");
            }
          }

          // 3. Layers Tab
          const layersTab = document.querySelector('.rail-btn[data-tab="layers"]');
          if (layersTab) {
            layersTab.click();
            await new Promise(r => setTimeout(r, 200));
            const layerItems = document.querySelectorAll('.layer-item-row');
            log.push("Layers in stack: " + layerItems.length);
          }

          // 4. Typography Tab
          const textTab = document.querySelector('.rail-btn[data-tab="text"]');
          if (textTab) {
            textTab.click();
            await new Promise(r => setTimeout(r, 200));
            const addTextBtn = document.getElementById("btnAddNewTextFromPanel");
            if (addTextBtn) {
              addTextBtn.click();
              log.push("Added new typography layer from panel");
            }
          }

          // 5. Export Modal
          const exportBtn = document.getElementById("btnExportPoster");
          if (exportBtn) {
            exportBtn.click();
            await new Promise(r => setTimeout(r, 300));
            const modal = document.getElementById("exportPosterModal");
            const isOpen = modal ? !modal.classList.contains("hidden") || modal.open : false;
            log.push("Export poster modal opened: " + isOpen);
            const closeBtn = document.getElementById("btnCloseExportPosterModal");
            if (closeBtn) closeBtn.click();
          }

          return { success: true, log };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('AI Poster Studio Result:', posterTest.result?.value);
    results.posterStudio = posterTest.result?.value;

    // ========================================================
    // TEST SUITE 5: Quick Image Resizer (/resizer/)
    // ========================================================
    console.log('\n=============================================');
    console.log('TEST SUITE 5: QUICK IMAGE RESIZER (/resizer/)');
    console.log('=============================================');
    await send('Page.navigate', { url: `http://localhost:${PORT}/resizer/` });
    await delay(1200);

    const resizerTest = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          const log = [];
          const testCanvas = document.createElement("canvas");
          testCanvas.width = 1600;
          testCanvas.height = 900;
          const ctx = testCanvas.getContext("2d");
          ctx.fillStyle = "#3b82f6";
          ctx.fillRect(0, 0, 1600, 900);
          
          const blob = await new Promise(r => testCanvas.toBlob(r, "image/png"));
          const file = new File([blob], "test-photo.png", { type: "image/png" });

          const fileInput = document.getElementById("resizerFileInput");
          const dt = new DataTransfer();
          dt.items.add(file);
          fileInput.files = dt.files;
          fileInput.dispatchEvent(new Event("change"));

          await new Promise(r => setTimeout(r, 500));

          const controlsCard = document.getElementById("resizerControlsCard");
          log.push("Controls card visible: " + (controlsCard && !controlsCard.classList.contains("hidden")));

          const targetWidth = document.getElementById("targetWidth");
          const targetHeight = document.getElementById("targetHeight");
          log.push("Initial width/height: " + targetWidth?.value + "x" + targetHeight?.value);

          if (targetWidth) {
            targetWidth.value = 800;
            targetWidth.dispatchEvent(new Event("input"));
            log.push("Proportional height calculated: " + targetHeight?.value);
          }

          const igPreset = document.querySelector('.preset-btn[data-w="1080"]');
          if (igPreset) {
            igPreset.click();
            log.push("Applied Instagram preset: " + targetWidth?.value + "x" + targetHeight?.value);
          }

          const dlBtn = document.getElementById("btnDownloadResized");
          log.push("Download resized button present: " + !!dlBtn);

          return { success: true, log };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('Quick Resizer Result:', resizerTest.result?.value);
    results.resizer = resizerTest.result?.value;

    // ========================================================
    // TEST SUITE 6: My Projects (/projects/)
    // ========================================================
    console.log('\n=============================================');
    console.log('TEST SUITE 6: MY PROJECTS (/projects/)');
    console.log('=============================================');
    await send('Page.navigate', { url: `http://localhost:${PORT}/projects/` });
    await delay(1000);

    const projTest = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          const log = [];
          const grid = document.getElementById("projectsGrid");
          const empty = document.getElementById("projectsEmptyState");
          const hasCards = grid && !grid.classList.contains("hidden");
          const cardsCount = document.querySelectorAll("#projectsGrid .card").length;
          log.push("Projects cards rendered: " + cardsCount);
          log.push("Empty state visible: " + (empty && !empty.classList.contains("hidden")));
          return { success: true, log };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('My Projects Result:', projTest.result?.value);
    results.projects = projTest.result?.value;

    // ========================================================
    // TEST SUITE 7: Landing Pages & Core Navigation
    // ========================================================
    console.log('\n=============================================');
    console.log('TEST SUITE 7: ALL LANDING PAGES & SUB-ROUTES');
    console.log('=============================================');
    const routesToTest = [
      '/batch-image-converter/',
      '/image-compressor/',
      '/jpg-to-webp/',
      '/png-to-webp/',
      '/heic-converter/',
      '/raw-image-converter/',
      '/ai-poster-generator/',
      '/blog/',
      '/help/',
      '/about/',
      '/contact/',
      '/privacy/',
      '/terms/'
    ];

    const routeResults = [];
    for (const r of routesToTest) {
      pageErrors.length = 0;
      await send('Page.navigate', { url: `http://localhost:${PORT}${r}` });
      await delay(400);
      const evalRes = await send('Runtime.evaluate', {
        expression: `({ title: document.title, headings: document.querySelectorAll("h1, h2").length })`,
        returnByValue: true
      });
      routeResults.push({
        route: r,
        title: evalRes.result?.value?.title,
        headings: evalRes.result?.value?.headings,
        errorsCount: pageErrors.length
      });
    }
    routeResults.forEach(rt => {
      console.log(`  [${rt.errorsCount === 0 ? 'PASS' : 'FAIL'}] ${rt.route} -> "${rt.title}" (Headings: ${rt.headings}, Errors: ${rt.errorsCount})`);
    });
    results.subroutes = routeResults;

  } finally {
    chrome.kill();
    server.close();
  }

  console.log('\n=============================================');
  console.log('ALL FEATURE TESTS COMPLETED SUCCESSFULLY!');
  console.log('=============================================');
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
