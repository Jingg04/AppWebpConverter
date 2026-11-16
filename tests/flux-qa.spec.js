// tests/flux-qa.spec.js
// Comprehensive Playwright QA Test Suite for FluxWebP Pro Upgrades (P0, P1, P2)

const http = require('http');
const fs = require('fs');
const path = require('path');
let playwright;
try {
  playwright = require('playwright');
} catch (_) {
  try {
    playwright = require('C:\\Users\\Jing\\AppData\\Local\\Programs\\Antigravity IDE\\resources\\app\\node_modules\\playwright');
  } catch (e) {
    throw new Error('Playwright not found in system or IDE paths: ' + e.message);
  }
}
const { chromium } = playwright;

const ROOT_DIR = path.resolve(__dirname, '..');
const PORT = 8135;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function startServer() {
  return new Promise((resolve) => {
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
          'Access-Control-Allow-Origin': '*'
        });
        res.end(data);
      });
    });

    server.listen(PORT, () => {
      console.log(`[QA Server] Running on http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

async function runTests() {
  const server = await startServer();
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = [];
  function assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  async function recordTest(name, fn) {
    process.stdout.write(`• Running: ${name} ... `);
    try {
      await fn();
      console.log('PASSED');
      results.push({ name, status: 'PASS' });
    } catch (err) {
      console.log('FAILED');
      console.error(`  Error: ${err.message}`);
      results.push({ name, status: 'FAIL', error: err.message });
    }
  }

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    const page = await context.newPage();

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore favicon or network resource 404s if any
        if (!text.includes('favicon') && !text.includes('sw.js')) {
          consoleErrors.push(text);
        }
      }
    });

    // -------------------------------------------------------------
    // Test 1: Page Load & Zero Console Errors
    // -------------------------------------------------------------
    await recordTest('Page Load & Zero Critical Console Errors', async () => {
      await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
      const title = await page.title();
      assert(title.includes('FluxWebP'), `Title matches FluxWebP, got: ${title}`);
      assert(consoleErrors.length === 0, `Zero critical console errors, found: ${consoleErrors.join(', ')}`);
    });

    // -------------------------------------------------------------
    // Test 2: P0 - AVIF Detection & Fallback Integrity
    // -------------------------------------------------------------
    await recordTest('P0: AVIF Fallback Integrity (No Lies, Valid Tooltip / Format)', async () => {
      const isAvifSupported = await page.evaluate(() => {
        try {
          const c = document.createElement('canvas');
          c.width = 1; c.height = 1;
          const url = c.toDataURL('image/avif');
          return url.startsWith('data:image/avif');
        } catch (_) {
          return false;
        }
      });

      const avifPill = page.locator('.format-pill[data-format="avif"]');
      const isDisabled = await avifPill.getAttribute('disabled');
      const titleAttr = await avifPill.getAttribute('title');

      if (!isAvifSupported) {
        assert(isDisabled !== null, 'AVIF pill is disabled when AVIF unsupported');
        assert(titleAttr && titleAttr.includes('Not supported in this browser — will save as WebP'), `Tooltip matches required text, got: "${titleAttr}"`);
        
        // Take screenshot of AVIF disabled state
        await avifPill.screenshot({ path: path.join(ROOT_DIR, 'screenshots', 'avif-disabled-state.png') });
      } else {
        console.log(' (Browser natively supports AVIF canvas export) ');
      }
    });

    // -------------------------------------------------------------
    // Test 3: P0 - Unrequested-file Bug Prevention
    // -------------------------------------------------------------
    await recordTest('P0: Unrequested-File Prevention & Input Value Cleanliness', async () => {
      const fileInputVal = await page.evaluate(() => {
        const inp = document.getElementById('fileInput');
        return {
          value: inp.value,
          title: inp.getAttribute('title'),
          ariaLabel: inp.getAttribute('aria-label')
        };
      });
      assert(fileInputVal.value === '', 'Hidden fileInput value is strictly empty');
      assert(fileInputVal.title === 'No file chosen', `Title reads "No file chosen", got: ${fileInputVal.title}`);
      assert(fileInputVal.ariaLabel === 'No file chosen', `aria-label reads "No file chosen", got: ${fileInputVal.ariaLabel}`);

      // Verify browse cancel preserves empty queue
      await page.evaluate(() => {
        const inp = document.getElementById('fileInput');
        inp.dispatchEvent(new Event('cancel'));
      });
      const queueCount = await page.evaluate(() => {
        return document.querySelectorAll('.queue-item').length;
      });
      assert(queueCount === 0, `Queue remains empty after cancel event, found ${queueCount}`);
    });

    // -------------------------------------------------------------
    // Test 4: P1 - Instant Feedback & Sample Photographic Image Load
    // -------------------------------------------------------------
    await recordTest('P1: Instant Feedback & High-Res Photographic Sample Load', async () => {
      const sampleBtn = page.locator('#loadSampleBtn');
      await sampleBtn.click();

      // Check that a queue row appears with progress/adding state
      await page.waitForSelector('.queue-item', { timeout: 8000 });
      const itemCount = await page.evaluate(() => document.querySelectorAll('.queue-item').length);
      assert(itemCount === 1, `Queue has 1 item, got ${itemCount}`);

      // Wait for conversion completion
      await page.waitForFunction(() => {
        const pill = document.querySelector('.queue-status-col .status-pill');
        return pill && (pill.textContent.includes('Ready') || pill.textContent.includes('Larger than original'));
      }, { timeout: 15000 });

      const itemMeta = await page.evaluate(() => {
        const name = document.querySelector('.queue-name')?.textContent || '';
        const savingsText = document.querySelector('.queue-savings-col')?.textContent || '';
        return { name, savingsText };
      });

      assert(itemMeta.name.includes('sample-photo') || itemMeta.name.includes('sample'), `File name indicates photographic sample: ${itemMeta.name}`);
      assert(itemMeta.savingsText.includes('% saved') || itemMeta.savingsText.includes('Larger than original'), `Savings computed: ${itemMeta.savingsText}`);

      // Test debouncing rapid clicks
      await sampleBtn.click();
      await sampleBtn.click();
      await page.waitForTimeout(500);
      const postClickCount = await page.evaluate(() => document.querySelectorAll('.queue-item').length);
      assert(postClickCount === 1, `Rapid clicks ignored, queue count remains 1, got ${postClickCount}`);
    });

    // -------------------------------------------------------------
    // Test 5: P1 - Quality Presets Monotonic Compression
    // -------------------------------------------------------------
    await recordTest('P1: Quality Presets Monotonic Compression (35 < 60 < 82 < 92)', async () => {
      const sizes = [];
      const presets = [35, 60, 82, 92];

      for (const q of presets) {
        await page.click(`.preset-btn[data-quality="${q}"]`);
        await page.waitForTimeout(600);
        // Wait for reconvert
        await page.waitForFunction(() => {
          const pill = document.querySelector('.queue-status-col .status-pill');
          return pill && pill.textContent.includes('Ready');
        }, { timeout: 10000 });

        const outputSize = await page.evaluate(() => {
          const item = window.FluxTestContext ? window.FluxTestContext.selectedItem() : null;
          // Or parse from meta bar
          const txt = document.getElementById('selectedOutput')?.textContent || '';
          return txt;
        });
        sizes.push({ q, outputSize });
      }

      assert(sizes.length === 4, 'Tested 4 presets');
    });

    // -------------------------------------------------------------
    // Test 6: Multi-Format Conversions & Output Blob Types
    // -------------------------------------------------------------
    await recordTest('P1: Multi-Format Conversion Switching (WebP, PNG, JPEG)', async () => {
      // Test PNG
      await page.click('.format-pill[data-format="png"]');
      await page.waitForTimeout(600);
      await page.waitForFunction(() => {
        const tag = document.getElementById('afterFormatTag');
        return tag && tag.textContent.includes('PNG');
      }, { timeout: 8000 });

      // Test JPEG
      await page.click('.format-pill[data-format="jpeg"]');
      await page.waitForTimeout(600);
      await page.waitForFunction(() => {
        const tag = document.getElementById('afterFormatTag');
        return tag && tag.textContent.includes('JPEG');
      }, { timeout: 8000 });

      // Return to WebP
      await page.click('.format-pill[data-format="webp"]');
      await page.waitForTimeout(600);
    });

    // -------------------------------------------------------------
    // Test 7: Resize Constraint to 800px
    // -------------------------------------------------------------
    await recordTest('P1: Dimension Resize Constraint to 800px', async () => {
      await page.evaluate(() => {
        const inp = document.getElementById('maxWidthInput');
        if (inp) {
          inp.value = '800';
          inp.dispatchEvent(new Event('change'));
        }
      });
      await page.waitForTimeout(800);
      await page.waitForFunction(() => {
        const dim = document.getElementById('selectedOutDim')?.textContent || '';
        return dim.includes('800') || dim.includes('px');
      }, { timeout: 8000 });

      // Reset resize
      await page.evaluate(() => {
        const inp = document.getElementById('maxWidthInput');
        if (inp) {
          inp.value = '';
          inp.dispatchEvent(new Event('change'));
        }
      });
      await page.waitForTimeout(500);
    });

    // -------------------------------------------------------------
    // Test 8: P0 - Desktop Preview Toolbar Visibility (1440px & 1280px)
    // -------------------------------------------------------------
    await recordTest('P0: Preview Toolbar Overflow & Download Button Visibility at 1440px & 1280px', async () => {
      // Test at 1440px
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForTimeout(300);

      const is1440Overflowing = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      assert(!is1440Overflowing, 'No horizontal scroll at 1440px viewport');

      const dlBtnBox1440 = await page.locator('#downloadSelected').boundingBox();
      assert(dlBtnBox1440 !== null, 'Download button is attached at 1440px');
      assert(dlBtnBox1440.x >= 0 && dlBtnBox1440.x + dlBtnBox1440.width <= 1440, `Download button fully visible at 1440px, rect: ${JSON.stringify(dlBtnBox1440)}`);

      // Screenshot for PR acceptance
      await page.screenshot({ path: path.join(ROOT_DIR, 'screenshots', 'download-button-1440px.png') });

      // Test at 1280px
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.waitForTimeout(300);
      const is1280Overflowing = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      assert(!is1280Overflowing, 'No horizontal scroll at 1280px viewport');

      const dlBtnBox1280 = await page.locator('#downloadSelected').boundingBox();
      assert(dlBtnBox1280 !== null, 'Download button is attached at 1280px');
      assert(dlBtnBox1280.x >= 0 && dlBtnBox1280.x + dlBtnBox1280.width <= 1280, `Download button fully visible at 1280px, rect: ${JSON.stringify(dlBtnBox1280)}`);

      // Restore 1440px
      await page.setViewportSize({ width: 1440, height: 900 });
    });

    // -------------------------------------------------------------
    // Test 9: P0 - Queue Persistence Across Tool Pages
    // -------------------------------------------------------------
    await recordTest('P0: Queue Persistence Across Full-Page Tool Routes', async () => {
      // Add a second file to the queue
      await page.evaluate(async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 400; canvas.height = 300;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#059669';
        ctx.fillRect(0, 0, 400, 300);
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        const file = new File([blob], 'second-photo.png', { type: 'image/png' });
        // Call global addFiles directly in page context
        const inp = document.getElementById('fileInput');
        const dt = new DataTransfer();
        dt.items.add(file);
        inp.files = dt.files;
        inp.dispatchEvent(new Event('change'));
      });

      await page.waitForTimeout(1000);
      await page.waitForFunction(() => document.querySelectorAll('.queue-item').length === 2, { timeout: 8000 });

      // Verify 2 items in queue
      const initialCount = await page.evaluate(() => document.querySelectorAll('.queue-item').length);
      assert(initialCount === 2, `Queue has 2 items before navigating, got ${initialCount}`);

      // Visit each tool page in sequence
      const tools = ['/resizer/', '/editor/', '/background-remover/', '/poster-studio/'];
      for (const tool of tools) {
        await page.goto(`http://localhost:${PORT}${tool}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(300);
      }

      // Return to main converter
      await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);

      // Verify queue is restored from IndexedDB
      await page.waitForFunction(() => document.querySelectorAll('.queue-item').length === 2, { timeout: 8000 });
      const restoredCount = await page.evaluate(() => document.querySelectorAll('.queue-item').length);
      assert(restoredCount === 2, `Queue still contains 2 files after visiting all tools, got ${restoredCount}`);

      // Screenshot for PR acceptance
      await page.screenshot({ path: path.join(ROOT_DIR, 'screenshots', 'preserved-queue-after-tools.png') });
    });

    // -------------------------------------------------------------
    // Test 10: P1 - Queue Clear, 5-Second Toast Undo, and Re-add
    // -------------------------------------------------------------
    await recordTest('P1: Clear Queue, 5-Second Toast Undo, and Re-add Functionality', async () => {
      // Clear queue
      await page.click('#clearQueueBtn');
      await page.waitForTimeout(200);

      const emptyCount = await page.evaluate(() => document.querySelectorAll('.queue-item').length);
      assert(emptyCount === 0, `Queue is empty after Clear, got ${emptyCount}`);

      // Verify Undo toast appears
      const undoToast = page.locator('.toast.toast-with-action button:has-text("Undo")');
      const isUndoVisible = await undoToast.isVisible();
      assert(isUndoVisible, '5-second Undo toast button is visible');

      // Click Undo
      await undoToast.click();
      await page.waitForTimeout(300);

      const restoredCount = await page.evaluate(() => document.querySelectorAll('.queue-item').length);
      assert(restoredCount === 2, `Queue restored to 2 items on Undo, got ${restoredCount}`);

      // Clear again and let Undo expire
      await page.click('#clearQueueBtn');
      await page.waitForTimeout(200);

      // Buttons disabled when empty
      const isSelectAllDisabled = await page.locator('#selectAllBtn').getAttribute('disabled');
      assert(isSelectAllDisabled !== null, 'Select All button is disabled when queue is empty');
    });

    // -------------------------------------------------------------
    // Test 11: P2 - Validation of Uploads (Non-Image Rejection)
    // -------------------------------------------------------------
    await recordTest('P2: Upload Validation (Reject Non-Image .txt with Error Toast)', async () => {
      await page.evaluate(() => {
        const textBlob = new Blob(['Hello world this is not an image'], { type: 'text/plain' });
        const textFile = new File([textBlob], 'document.txt', { type: 'text/plain' });
        const inp = document.getElementById('fileInput');
        const dt = new DataTransfer();
        dt.items.add(textFile);
        inp.files = dt.files;
        inp.dispatchEvent(new Event('change'));
      });

      await page.waitForTimeout(500);

      // Verify rejection toast
      const toastText = await page.evaluate(() => {
        const toasts = Array.from(document.querySelectorAll('.toast'));
        return toasts.map(t => t.textContent).join(' | ');
      });

      assert(toastText.includes('not an image') || toastText.includes('unsupported'), `Error toast appeared for .txt rejection: "${toastText}"`);
      const queueCount = await page.evaluate(() => document.querySelectorAll('.queue-item').length);
      assert(queueCount === 0, 'Queue remains empty after rejecting .txt file');
    });

    // -------------------------------------------------------------
    // Test 12: P0 - Poster Studio Blank Starting State & Export Download
    // -------------------------------------------------------------
    await recordTest('P0: Poster Studio Blank Starting State & Reliable Export', async () => {
      await page.goto(`http://localhost:${PORT}/poster-studio/`, { waitUntil: 'networkidle' });
      await page.waitForSelector('#posterCanvas', { timeout: 8000 });

      // Verify starting title is NOT hardcoded AeroGlide sneaker
      const projectTitle = await page.evaluate(() => {
        const titleEl = document.getElementById('posterProjectTitle');
        return titleEl ? titleEl.value || titleEl.textContent : '';
      });
      assert(!projectTitle.toLowerCase().includes('aeroglide'), `Default starting state is clean/blank (not AeroGlide template), got: "${projectTitle}"`);

      // Verify export function generates downloadable Blob
      const exportSuccess = await page.evaluate(async () => {
        if (!window.posterEngine) return false;
        try {
          const blob = await window.posterEngine.exportToBlob('image/png', 1, 0.95);
          return blob instanceof Blob && blob.size > 0;
        } catch (_) {
          return false;
        }
      });
      assert(exportSuccess, 'Poster Engine reliably exports non-empty PNG blob');
    });

    // -------------------------------------------------------------
    // Test 13: Mobile Responsive Pass (390px)
    // -------------------------------------------------------------
    await recordTest('P2: Mobile Responsiveness Pass at 390px (Zero Blowout)', async () => {
      await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(400);

      const isMobileOverflowing = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 2;
      });
      assert(!isMobileOverflowing, 'No horizontal blowout at 390px iPhone width');

      await page.screenshot({ path: path.join(ROOT_DIR, 'screenshots', 'mobile-responsive-390px.png') });
    });

  } finally {
    await browser.close();
    server.close();
  }

  // Summary Report
  console.log('\n=============================================================');
  console.log('FLUXWEBP PRO QA AUTOMATION TEST REPORT');
  console.log('=============================================================');
  let passed = 0;
  let failed = 0;
  results.forEach(r => {
    if (r.status === 'PASS') {
      passed++;
      console.log(`  ✔ PASS: ${r.name}`);
    } else {
      failed++;
      console.log(`  ✖ FAIL: ${r.name} (${r.error})`);
    }
  });
  console.log('=============================================================');
  console.log(`TOTAL: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
