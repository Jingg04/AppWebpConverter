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
  assert(Array.isArray(transcoderModule.HANDBRAKE_PRESET_CATEGORIES), "HANDBRAKE_PRESET_CATEGORIES array exists");
  assert(transcoderModule.HANDBRAKE_PRESET_CATEGORIES.length === 5, `Has 5 preset categories (found ${transcoderModule.HANDBRAKE_PRESET_CATEGORIES.length})`);
  assert(Object.keys(transcoderModule.HANDBRAKE_PRESETS).length >= 18, `Has at least 18 presets (found ${Object.keys(transcoderModule.HANDBRAKE_PRESETS).length})`);

  // Verify preset keys
  const presets = transcoderModule.HANDBRAKE_PRESETS;
  assert(presets["web-1080p"] && presets["web-1080p"].codec === "vp9", "web-1080p preset configured for VP9");
  assert(presets["web-720p"] && presets["web-720p"].resolution === "720p", "web-720p preset configured for 720p");
  assert(presets["discord-25mb"] && presets["discord-25mb"].targetSizeMB === 24.0, "discord-25mb preset configured for 24MB target");

  // Verify Authentic HandBrake Core Presets (extracted from official HandBrake hb.dll)
  assert(presets["hb-fast-1080p"] && presets["hb-fast-1080p"].crf === 22, "HandBrake Fast 1080p30 preset configured (RF 22)");
  assert(presets["hb-hq-1080p"] && presets["hb-hq-1080p"].crf === 20, "HandBrake HQ 1080p30 Surround preset configured (RF 20)");
  assert(presets["hb-super-hq-1080p"] && presets["hb-super-hq-1080p"].crf === 18, "HandBrake Super HQ 1080p30 preset configured (RF 18)");
  assert(presets["hb-very-fast-1080p"] && presets["hb-very-fast-1080p"].crf === 24, "HandBrake Very Fast 1080p30 preset configured (RF 24)");
  assert(presets["hb-creator-1080p60"] && presets["hb-creator-1080p60"].fps === 60, "HandBrake Creator 1080p60 preset configured (60 FPS)");
  assert(presets["hb-apple-1080p"] && presets["hb-apple-1080p"].category === "devices", "HandBrake Apple 1080p Universal preset configured");
  assert(presets["hb-android-1080p"] && presets["hb-android-1080p"].category === "devices", "HandBrake Android 1080p Universal preset configured");

  // Verify MP4 1-2GB to Under 100MB compressor presets
  assert(presets["mp4-100mb"] !== undefined, "mp4-100mb preset exists");
  assert(presets["mp4-100mb"].format === "mp4", "mp4-100mb preset format is 'mp4'");
  assert(presets["mp4-100mb"].codec === "h264", "mp4-100mb preset codec is 'h264'");
  assert(presets["mp4-100mb"].targetSizeMB === 95.0, "mp4-100mb preset targetSizeMB is 95.0MB (safety headroom under 100MB)");
  assert(presets["mp4-100mb"].adaptiveScale === true, "mp4-100mb preset has adaptiveScale enabled for perceptual quality preservation");

  assert(presets["mp4-50mb"] && presets["mp4-50mb"].targetSizeMB === 48.0, "mp4-50mb preset configured for 48MB");
  assert(presets["mp4-25mb"] && presets["mp4-25mb"].targetSizeMB === 24.0, "mp4-25mb preset configured for 24MB");

  assert(transcoderModule.isAcceptedVideo({ name: "huge_capture_2gb.mp4", type: "video/mp4" }) === true, "Accepts .mp4 video");
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

    // Verify Nav Item "HandBrake Video" exists
    const videoNavExists = await page.locator("nav a[data-tab='video']").count();
    const videoNavText = await page.locator("nav a[data-tab='video']").textContent();
    assert(videoNavExists === 1, "Header navigation contains video transcode nav link");
    assert(videoNavText.includes("HandBrake Video"), `Header navigation text is 'HandBrake Video' (got: ${videoNavText.replace(/\s+/g, ' ').trim()})`);

    // Click "HandBrake Video" nav item
    await page.click("nav a[data-tab='video']");
    await page.waitForTimeout(300);

    // Verify view-video becomes active
    const isVideoViewActive = await page.locator("#view-video.app-view.active").count();
    assert(isVideoViewActive === 1, "#view-video app-view became active on navigation click");

    // Verify Category Tabs are rendered
    const catPillCount = await page.locator("#hbPresetCategories .hb-cat-pill").count();
    assert(catPillCount === 5, `Preset category tabs rendered 5 pills (got ${catPillCount})`);

    // Verify All Presets are rendered by default
    const presetPillCount = await page.locator("#hbPresetsList .hb-preset-pill").count();
    assert(presetPillCount === 19, `HandBrake presets bar rendered all ${presetPillCount} preset pills`);

    // Test Category Filtering: Click ⚡ 1–2GB Compressor
    await page.click("#hbPresetCategories button[data-category='100mb']");
    await page.waitForTimeout(100);
    const count100mb = await page.locator("#hbPresetsList .hb-preset-pill").count();
    assert(count100mb === 3, `1–2GB Compressor category displays 3 presets (got ${count100mb})`);

    // Test Category Filtering: Click General (HandBrake Core)
    await page.click("#hbPresetCategories button[data-category='general']");
    await page.waitForTimeout(100);
    const countGeneral = await page.locator("#hbPresetsList .hb-preset-pill").count();
    assert(countGeneral === 5, `General HandBrake Core category displays 5 presets (got ${countGeneral})`);

    // Test Category Filtering: Click Devices
    await page.click("#hbPresetCategories button[data-category='devices']");
    await page.waitForTimeout(100);
    const countDevices = await page.locator("#hbPresetsList .hb-preset-pill").count();
    assert(countDevices === 2, `Devices category displays 2 presets (got ${countDevices})`);

    // Return to All Presets
    await page.click("#hbPresetCategories button[data-category='all']");
    await page.waitForTimeout(100);
    const countAll = await page.locator("#hbPresetsList .hb-preset-pill").count();
    assert(countAll === 19, `All Presets restores full list of 19 presets (got ${countAll})`);

    // Verify Dropzone and Load Sample Video button exist
    const dropzoneExists = await page.locator("#hbDropzone").count();
    const sampleBtnExists = await page.locator("#hbBtnLoadSample").count();
    assert(dropzoneExists === 1, "HandBrake dropzone element present");
    assert(sampleBtnExists === 1, "Load Sample Video button present");

    // Test 2.2: Preset Switching & MP4 1-2GB -> Under 100MB Controls
    console.log("\n--- Phase 3: Presets & MP4 Compressor Controls Verification ---");
    await page.click("#hbPresetsList button[data-preset-id='discord-25mb']");
    await page.waitForTimeout(100);

    // Check that target size radio is selected
    const isTargetSizeChecked = await page.evaluate(() => {
      const r = document.querySelector("input[name='hbQualityMode'][value='target-size']");
      return r ? r.checked : false;
    });
    assert(isTargetSizeChecked === true, "Selecting 'discord-25mb' preset activates target-size mode");

    // Select MP4 1–2GB to Under 100MB preset
    await page.click("#hbPresetsList button[data-preset-id='mp4-100mb']");
    await page.waitForTimeout(100);

    const mp4FormatState = await page.evaluate(() => {
      const sel = document.getElementById("hbFormatSelect");
      const codecSel = document.getElementById("hbCodecSelect");
      const targetInput = document.getElementById("hbTargetSizeInput");
      const mp4Pill = document.querySelector(".hb-format-pill[data-format='mp4']");
      const notice = document.getElementById("hbTargetQualityNotice");
      return {
        format: sel ? sel.value : null,
        codec: codecSel ? codecSel.value : null,
        targetMB: targetInput ? Number(targetInput.value) : null,
        isPillActive: mp4Pill ? mp4Pill.classList.contains("active") : false,
        hasNotice: notice ? notice.textContent.length > 10 : false
      };
    });
    assert(mp4FormatState.format === "mp4", `mp4-100mb sets format to 'mp4' (got ${mp4FormatState.format})`);
    assert(mp4FormatState.codec === "h264", `mp4-100mb sets video codec to 'h264' (got ${mp4FormatState.codec})`);
    assert(mp4FormatState.targetMB === 95, `mp4-100mb sets target size to 95MB (got ${mp4FormatState.targetMB})`);
    assert(mp4FormatState.isPillActive === true, "MP4 format pill is active");
    assert(mp4FormatState.hasNotice === true, "Perceptual quality notice is displayed for 1-2GB compressor");

    // Switch to Video & Quality tab to access rate control and target size
    await page.click("button.hb-tab-btn[data-tab='video']");
    await page.waitForTimeout(100);

    // Test Quick Target Size buttons
    const quickTarget48 = await page.locator("button.hb-quick-target-btn[data-target-mb='48']").count();
    assert(quickTarget48 === 1, "Quick Target Button 'Under 50MB (48MB)' is present");
    await page.click("button.hb-quick-target-btn[data-target-mb='48']");
    await page.waitForTimeout(100);
    const targetSizeVal48 = await page.locator("#hbTargetSizeInput").inputValue();
    assert(targetSizeVal48 === "48", `Clicking quick target sets target size to 48MB (got ${targetSizeVal48})`);

    // Reset back to Under 100MB
    await page.click("button.hb-quick-target-btn[data-target-mb='95']");
    await page.waitForTimeout(100);
    const targetSizeVal95 = await page.locator("#hbTargetSizeInput").inputValue();
    assert(targetSizeVal95 === "95", `Clicking quick target resets target size to 95MB (got ${targetSizeVal95})`);

    // Test 2.3: Generate Synthetic Sample Video and Load into Transcoder
    console.log("\n--- Phase 4: Sample Video Loading & Auto 100MB Preset ---");
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
    assert(isTranscodeEnabled === true, "Start Transcode button is enabled after video load");

    // Test 2.4: Execute End-to-End MP4 Transcode
    console.log("\n--- Phase 5: End-to-End MP4 Compression Transcode ---");
    // Select MP4 preset
    await page.click("#hbPresetsList button[data-preset-id='mp4-100mb']");
    await page.waitForTimeout(200);

    // Set trim end to 2 seconds for fast automated testing
    await page.evaluate(() => {
      const trimEnd = document.getElementById("hbTrimSliderEnd");
      if (trimEnd) {
        trimEnd.value = "2";
        trimEnd.dispatchEvent(new Event("input"));
      }
    });

    // Click Start Transcode
    await page.click("#hbBtnStartTranscode");

    // Wait for Result stage to appear
    await page.waitForSelector("#hbResultStage:not(.hidden)", { timeout: 35000 });
    console.log("  [INFO] Transcoding completed and Result Stage appeared!");

    const resultData = await page.evaluate(() => {
      const codecBadge = document.getElementById("hbStatCodecBadge");
      const dlBtn = document.getElementById("hbBtnDownloadWebm");
      const outputVideo = document.getElementById("hbOutputVideoPlayer");
      const statSaved = document.getElementById("hbStatSavedBadge");
      return {
        codecBadgeText: codecBadge ? codecBadge.textContent : "",
        dlBtnText: dlBtn ? dlBtn.textContent : "",
        hasSrc: outputVideo ? !!outputVideo.src : false,
        savedText: statSaved ? statSaved.textContent : ""
      };
    });

    assert(resultData.codecBadgeText.includes("H264") && resultData.codecBadgeText.includes("AAC"), `Codec badge shows H264 / AAC (got: ${resultData.codecBadgeText})`);
    assert(resultData.dlBtnText.includes("Download Optimized MP4"), `Download button reflects MP4 format (got: ${resultData.dlBtnText.trim()})`);
    assert(resultData.hasSrc === true, "Output video player is loaded with blob URL");

    // Test 2.5: Standalone Video Transcoder and MP4 Compressor Pages
    console.log("\n--- Phase 6: Standalone Pages & URL Redirection ---");
    await page.goto(`http://localhost:${PORT}/video-transcoder/`, { waitUntil: "domcontentloaded" });
    const standaloneTitle = await page.title();
    assert(standaloneTitle.includes("HandBrake Web"), `Standalone page loaded with title: ${standaloneTitle}`);

    const standalonePresetsCount = await page.locator("#hbPresetsList .hb-preset-pill").count();
    assert(standalonePresetsCount === 19, `Standalone page rendered all ${standalonePresetsCount} presets`);

    const standaloneCatCount = await page.locator("#hbPresetCategories .hb-cat-pill").count();
    assert(standaloneCatCount === 5, `Standalone page rendered ${standaloneCatCount} category tabs`);

    // Test /mp4-compressor/ entry
    await page.goto(`http://localhost:${PORT}/mp4-compressor/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    const finalUrl = page.url();
    assert(finalUrl.includes("/video-transcoder/"), `mp4-compressor route redirects to video-transcoder (url: ${finalUrl})`);

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
