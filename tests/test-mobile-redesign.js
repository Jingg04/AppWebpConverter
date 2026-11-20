// tests/test-mobile-redesign.js
// Automated QA Test for Native Mobile App UI & UX Redesign

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
const PORT = 8145;
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
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }

      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found: " + reqPath);
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": mimeTypes[ext] || "application/octet-stream",
        "Access-Control-Allow-Origin": "*"
      });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(PORT, () => {
      console.log(`[Mobile Test Server] Running at http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

async function runMobileTests() {
  console.log("====================================================");
  console.log(" Native Mobile App UI & UX QA Test Suite");
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

  const server = await startServer();
  const launchOptions = {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  };
  if (fs.existsSync(CHROME_PATH)) {
    launchOptions.executablePath = CHROME_PATH;
  }
  const browser = await chromium.launch(launchOptions);

  try {
    // ----------------------------------------------------
    // TEST 1: MOBILE APP EXPERIENCE (390 x 844)
    // ----------------------------------------------------
    console.log("\n--- Phase 1: Mobile Viewport (iPhone 14/15 390x844) ---");
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true
    });
    const page = await mobileContext.newPage();

    await page.goto(`http://localhost:${PORT}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);

    // 1.1 Verify Mobile Bottom Nav is Visible
    const bottomNavVisible = await page.locator("#mobileBottomNav").isVisible();
    assert(bottomNavVisible === true, "Mobile bottom navigation bar is visible on mobile screen");

    // 1.2 Verify Desktop Nav is Hidden on Mobile
    const desktopNavVisible = await page.locator(".primary-nav").isVisible();
    assert(desktopNavVisible === false, "Desktop header navigation list is cleanly hidden on mobile");

    // 1.3 Verify Mobile Current Tab Pill in Header
    const currentTabPillVisible = await page.locator("#mobileCurrentTabPill").isVisible();
    const currentTabTitle = await page.locator("#mobileTabTitle").textContent();
    assert(currentTabPillVisible === true, "Mobile current tab indicator pill is visible in header");
    assert(currentTabTitle.trim().length > 0, `Mobile tab title displayed: '${currentTabTitle.trim()}'`);

    // 1.4 Test Mobile Bottom Nav: Tap Video Tab
    console.log("\n--- Phase 2: Mobile Navigation to HandBrake Video Transcoder ---");
    await page.click("#mobileBottomNav .mobile-nav-item[data-tab='video']");
    await page.waitForTimeout(300);

    const isVideoActive = await page.locator("#view-video.app-view.active").count();
    const isVideoTabActive = await page.evaluate(() => {
      const el = document.querySelector("#mobileBottomNav .mobile-nav-item[data-tab='video']");
      return el && el.classList.contains("active");
    });
    const updatedTabTitle = await page.locator("#mobileTabTitle").textContent();

    assert(isVideoActive === 1, "#view-video view became active upon tapping mobile bottom nav");
    assert(isVideoTabActive === true, "Video tab in mobile bottom nav has .active class");
    assert(updatedTabTitle.includes("Video"), `Mobile header updated tab title to: '${updatedTabTitle.trim()}'`);

    // 1.5 Verify HandBrake Video UI on Mobile
    console.log("\n--- Phase 3: HandBrake Video Transcoder Touch UX on Mobile ---");
    const dropzoneVisible = await page.locator("#hbDropzone").isVisible();
    const formatCapsulesCount = await page.locator(".hb-format-capsules .hb-capsule").count();
    assert(dropzoneVisible === true, "HandBrake dropzone is visible and styled on mobile");
    assert(formatCapsulesCount >= 4, `Dropzone shows format capsules (found ${formatCapsulesCount})`);

    // Verify Presets Carousel
    const presetsVisible = await page.locator("#hbPresetsList").isVisible();
    assert(presetsVisible === true, "Presets scrollable list is visible on mobile");

    // Verify Tab Panels switch on mobile
    await page.click("button.hb-tab-btn[data-tab='dimensions']");
    await page.waitForTimeout(100);
    const dimensionsPanelActive = await page.locator("#hbTabPanel-dimensions.active").count();
    assert(dimensionsPanelActive === 1, "Dimensions tab panel activated on mobile tap");

    await page.click("button.hb-tab-btn[data-tab='video']");
    await page.waitForTimeout(100);
    const videoPanelActive = await page.locator("#hbTabPanel-video.active").count();
    const rateCardsCount = await page.locator(".hb-rate-mode-cards .hb-rate-card").count();
    assert(videoPanelActive === 1, "Video & Quality tab panel activated on mobile tap");
    assert(rateCardsCount === 3, "Rate mode cards rendered 3 options (CRF, Bitrate, Target Size)");

    // 1.6 Test Mobile Studio Bottom Sheet
    console.log("\n--- Phase 4: Mobile Studio Bottom Sheet & Drawer ---");
    await page.click("#mobileToolsTrigger");
    await page.waitForTimeout(300);

    const isSheetOpen = await page.locator("#mobileStudioSheet.open").count();
    const isBackdropShow = await page.locator("#mobileSheetBackdrop.show").count();
    const sheetToolsCount = await page.locator(".sheet-tools-grid .sheet-tool-card").count();

    assert(isSheetOpen === 1, "Mobile Studio bottom sheet slid up into view (.open)");
    assert(isBackdropShow === 1, "Mobile sheet frosted backdrop is active (.show)");
    assert(sheetToolsCount >= 8, `Studio bottom sheet rendered ${sheetToolsCount} tool cards`);

    // Test Sheet Tool Navigation (Tap Formats inside sheet or Close button)
    await page.click("#closeMobileSheetBtn");
    await page.waitForTimeout(300);

    const isSheetClosed = await page.locator("#mobileStudioSheet.open").count();
    assert(isSheetClosed === 0, "Mobile studio bottom sheet closed upon tapping close button");

    // Test Mobile Navigation to Formats
    await page.click("#mobileBottomNav .mobile-nav-item[data-tab='formats']");
    await page.waitForTimeout(200);
    const isFormatsActive = await page.locator("#view-formats.app-view.active").count();
    assert(isFormatsActive === 1, "Formats view active via mobile bottom nav");

    // Test Mobile Navigation to History
    await page.click("#mobileBottomNav .mobile-nav-item[data-tab='history']");
    await page.waitForTimeout(200);
    const isHistoryActive = await page.locator("#view-history.app-view.active").count();
    assert(isHistoryActive === 1, "History view active via mobile bottom nav");

    // Test Mobile Navigation to Converter
    await page.click("#mobileBottomNav .mobile-nav-item[data-tab='converter']");
    await page.waitForTimeout(200);
    const isConverterActive = await page.locator("#view-converter.app-view.active").count();
    assert(isConverterActive === 1, "Converter view active via mobile bottom nav");

    await mobileContext.close();

    // ----------------------------------------------------
    // TEST 2: DESKTOP VIEWPORT (1280 x 800)
    // ----------------------------------------------------
    console.log("\n--- Phase 5: Desktop Viewport Verification (1280x800) ---");
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });
    const desktopPage = await desktopContext.newPage();
    await desktopPage.goto(`http://localhost:${PORT}/#/video`, { waitUntil: "domcontentloaded" });
    await desktopPage.waitForTimeout(300);

    const desktopBottomNavVisible = await desktopPage.locator("#mobileBottomNav").isVisible();
    const desktopPrimaryNavVisible = await desktopPage.locator(".primary-nav").isVisible();
    const desktopViewVideoActive = await desktopPage.locator("#view-video.app-view.active").count();

    assert(desktopBottomNavVisible === false, "Mobile bottom nav is hidden on desktop viewport");
    assert(desktopPrimaryNavVisible === true, "Desktop primary navigation is visible");
    assert(desktopViewVideoActive === 1, "Desktop routes directly to #/video active view");

    await desktopContext.close();

  } catch (err) {
    console.error("Test error:", err);
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

runMobileTests();
