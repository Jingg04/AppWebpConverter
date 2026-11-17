// tests/test-video-transcoder.js
// Automated QA Test Suite for HandBrake Video Transcoder & WebM Encoding Feature

const http = require("http");
const fs = require("fs");
const path = require("path");

let playwright;
try {
  playwright = require("playwright");
} catch (_) {
  try {
    playwright = require("C:\\Users\\Jing\\AppData\\Local\\Programs\\Antigravity IDE\\resources\\app\\node_modules\\playwright");
  } catch (e) {
    throw new Error("Playwright not found: " + e.message);
  }
}
const { chromium } = playwright;

const ROOT_DIR = path.resolve(__dirname, "..");
const PORT = 8139;
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".svg": "image/svg+xml"
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url.split("?")[0];
      if (reqPath === "/") reqPath = "/index.html";

      let filePath = path.join(ROOT_DIR, reqPath);

      // Handle directories
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }

      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found: " + reqPath);
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = mimeTypes[ext] || "application/octet-stream";

      res.writeHead(200, {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*"
      });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(PORT, () => {
      console.log(`[Test Server] Running at http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

async function runTests() {
  console.log("====================================================");
  console.log(" HandBrake Video Transcoder & WebM QA Test Suite");
  console.log("====================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Pure Node.js unit tests
  console.log("\n--- Phase 1: Pure JavaScript Engine Tests ---");
  const transcoderModule = require(path.join(ROOT_DIR, "video-transcoder.js"));
  assert(transcoderModule !== undefined, "video-transcoder.js loads cleanly");
  assert(typeof transcoderModule.HANDBRAKE_PRESETS === "object", "HANDBRAKE_PRESETS object exists");
  assert(Object.keys(transcoderModule.HANDBRAKE_PRESETS).length >= 8, `Has at least 8 HandBrake presets (found ${Object.keys(transcoderModule.HANDBRAKE_PRESETS).length})`);

  // Verify preset keys
  const presets = transcoderModule.HANDBRAKE_PRESETS;
  assert(presets["web-1080p"] && presets["web-1080p"].codec === "vp9", "web-1080p preset configured for VP9");
  assert(presets["web-720p"] && presets["web-720p"].resolution === "720p", "web-720p preset configured for 720p");
  assert(presets["discord-25mb"] && presets["discord-25mb"].targetSizeMB === 24.0, "discord-25mb preset configured for 24MB target");

  assert(transcoderModule.isAcceptedVideo({ name: "movie.mp4", type: "video/mp4" }) === true, "Accepts .mp4 video");
  assert(transcoderModule.isAcceptedVideo({ name: "clip.webm", type: "video/webm" }) === true, "Accepts .webm video");
  assert(transcoderModule.isAcceptedVideo({ name: "raw.mkv", type: "video/x-matroska" }) === true, "Accepts .mkv video");
  assert(transcoderModule.isAcceptedVideo({ name: "photo.jpg", type: "image/jpeg" }) === false, "Rejects .jpg image as video");

  // 2. Playwright Browser Tests
  console.log("\n--- Phase 2: In-Browser Navigation & Transcoder UI Tests ---");
  const server = await startServer();
  const launchOptions = {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--autoplay-policy=no-user-gesture-required"]
  };
  if (fs.existsSync(CHROME_PATH)) {
    launchOptions.executablePath = CHROME_PATH;
  }
  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleLogs = [];
  const pageErrors = [];
  page.on("console", (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on("pageerror", (err) => pageErrors.push(err.message));

  try {
    // Test 2.1: Main app loads and Video nav tab works
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: "domcontentloaded" });
    const pageTitle = await page.title();
    assert(pageTitle.includes("FluxWebP"), `Main app loaded with title: ${pageTitle}`);

    // Verify Nav Item "Video to WebM" exists
    const videoNavExists = await page.locator("nav a[data-tab='video']").count();
    assert(videoNavExists === 1, "Header navigation contains 'Video to WebM' link");

    // Click "Video to WebM" nav item
    await page.click("nav a[data-tab='video']");
    await page.waitForTimeout(300);

    // Verify view-video becomes active
    const isVideoViewActive = await page.locator("#view-video.app-view.active").count();
    assert(isVideoViewActive === 1, "#view-video app-view became active on navigation click");

    // Verify Presets are rendered
    const presetPillCount = await page.locator("#hbPresetsList .hb-preset-pill").count();
    assert(presetPillCount >= 8, `HandBrake presets bar rendered with ${presetPillCount} preset pills`);

    // Verify Dropzone and Load Sample Video button exist
    const dropzoneExists = await page.locator("#hbDropzone").count();
    const sampleBtnExists = await page.locator("#hbBtnLoadSample").count();
    assert(dropzoneExists === 1, "HandBrake dropzone element present");
    assert(sampleBtnExists === 1, "Load Sample Video button present");

    // Test 2.2: Preset Switching
    console.log("\n--- Phase 3: Presets & Controls Verification ---");
    await page.click("#hbPresetsList button[data-preset-id='discord-25mb']");
    await page.waitForTimeout(100);

    // Check that target size radio is selected
    const isTargetSizeChecked = await page.evaluate(() => {
      const r = document.querySelector("input[name='hbQualityMode'][value='target-size']");
      return r ? r.checked : false;
    });
    assert(isTargetSizeChecked === true, "Selecting 'discord-25mb' preset activates target-size mode");

    // Switch back to 1080p
    await page.click("#hbPresetsList button[data-preset-id='web-1080p']");
    await page.waitForTimeout(100);
    const crfValueText = await page.locator("#hbCrfValue").textContent();
    assert(crfValueText === "24", `1080p preset sets CRF slider to 24 (got ${crfValueText})`);

    // Test 2.3: Generate Synthetic Sample Video and Load into Transcoder
    console.log("\n--- Phase 4: Sample Video Loading & Telemetry ---");
    await page.click("#hbBtnLoadSample");
    // Wait for sample video generation and telemetry display
    await page.waitForSelector("#hbSourceMetaCard:not(.hidden)", { timeout: 15000 });

    const sourceName = await page.locator("#hbSourceName").textContent();
    assert(sourceName.includes("sample-handbrake-source.webm"), `Sample video loaded: ${sourceName}`);

    const durationText = await page.locator("#hbSourceDuration").textContent();
    assert(durationText.includes("00:05") || durationText.includes("5"), `Sample duration detected: ${durationText}`);

    const resolutionText = await page.locator("#hbSourceResolution").textContent();
    assert(resolutionText.includes("1280") && resolutionText.includes("720"), `Sample resolution detected: ${resolutionText}`);

    // Verify Transcode button is now enabled
    const isTranscodeEnabled = await page.evaluate(() => {
      const btn = document.getElementById("hbBtnStartTranscode");
      return btn && !btn.disabled;
    });
    assert(isTranscodeEnabled === true, "Start WebM Transcode button is enabled after video load");

    // Test 2.4: Standalone Video Transcoder Page
    console.log("\n--- Phase 5: Standalone /video-transcoder/ Page Test ---");
    await page.goto(`http://localhost:${PORT}/video-transcoder/`, { waitUntil: "domcontentloaded" });
    const standaloneTitle = await page.title();
    assert(standaloneTitle.includes("HandBrake Web"), `Standalone page loaded with title: ${standaloneTitle}`);

    const standalonePresetsCount = await page.locator("#hbPresetsList .hb-preset-pill").count();
    assert(standalonePresetsCount >= 8, `Standalone page rendered ${standalonePresetsCount} presets`);

    // Check for page errors
    if (pageErrors.length > 0) {
      console.error("Browser page errors detected:", pageErrors);
    }
    assert(pageErrors.length === 0, `Zero browser page errors (count: ${pageErrors.length})`);

  } catch (err) {
    console.error("Test execution error:", err);
    failed++;
  } finally {
    await browser.close();
    server.close();
  }

  console.log("\n====================================================");
  console.log(` Test Summary: ${passed} passed, ${failed} failed`);
  console.log("====================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
