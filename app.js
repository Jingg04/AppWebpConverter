/**
 * FluxWebP Pro — Universal Image Optimization Platform
 * Pure Client-Side Architecture (WebAssembly, Canvas 2D, Stream Parsers, Zero Server Uploads)
 */

"use strict";

// --- Configuration & Constants ---
const HISTORY_KEY = "fluxwebp-history-v2";
const SETTINGS_KEY = "fluxwebp-settings-v2";
const THEME_KEY = "fluxwebp-theme";
const MAX_HISTORY = 50;

const RAW_EXTENSIONS = new Set([
  "arw", "srf", "sr2", // Sony
  "cr2", "cr3", "crw", // Canon
  "nef", "nrw",        // Nikon
  "dng",               // Adobe Digital Negative (Universal)
  "raf",               // Fujifilm
  "orf", "ori",        // Olympus / OM System
  "rw2", "raw",        // Panasonic Lumix
  "pef",               // Pentax
  "3fr", "fff",        // Hasselblad
  "mrw",               // Minolta
  "x3f",               // Sigma
  "rwl",               // Leica
  "srw",               // Samsung
  "iiq",               // Phase One
  "mos",               // Leaf
  "erf",               // Epson
  "kdc", "dcr", "k25"  // Kodak
]);

const ACCEPTED_EXTENSIONS = new Set([
  // Web & standard graphics
  "jpg", "jpeg", "jpe", "jif", "jfif", "png", "webp", "gif", "bmp", "dib", "svg", "svgz", "avif", "ico", "cur",
  // High efficiency & professional graphics
  "heic", "heif", "hif", "tif", "tiff", "psd", "psb", "tga", "targa", "hdr",
  // NetPBM formats
  "ppm", "pgm", "pbm", "pnm", "qoi",
  // Camera RAW formats
  ...RAW_EXTENSIONS
]);

const CODECS = {
  heic2any: "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js",
  utif: "https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.min.js",
  agPsd: "https://cdn.jsdelivr.net/npm/ag-psd@23.0.0/dist/bundle.js"
};

const FORMAT_CATALOG = [
  // Camera RAW Formats
  { ext: "ARW", name: "Sony Alpha RAW", category: "raw", engine: "Camera ISP Extractor", desc: "Sony Alpha mirrorless uncompressed & compressed 14-bit RAW sensor files." },
  { ext: "CR2", name: "Canon RAW 2", category: "raw", engine: "Camera ISP Extractor", desc: "Canon EOS DSLR and mirrorless linear sensor captures." },
  { ext: "CR3", name: "Canon RAW 3", category: "raw", engine: "ISOBMFF & ISP Engine", desc: "Modern Canon EOS mirrorless HEVC container RAW format." },
  { ext: "NEF", name: "Nikon Electronic Format", category: "raw", engine: "Camera ISP Extractor", desc: "Nikon Z-series mirrorless and DSLR native RAW captures." },
  { ext: "DNG", name: "Adobe Digital Negative", category: "raw", engine: "Universal RAW Parser", desc: "Open archival RAW standard used by Leica, Pentax, and mobile." },
  { ext: "RAF", name: "Fujifilm Camera RAW", category: "raw", engine: "RAF Header Scanner", desc: "Fujifilm X-Trans and Bayer sensor mirrorless RAW captures." },
  { ext: "ORF", name: "Olympus Camera RAW", category: "raw", engine: "TIFF-ISP Stream", desc: "Olympus & OM System Micro Four Thirds sensor files." },
  { ext: "RW2", name: "Panasonic Lumix RAW", category: "raw", engine: "Lumix ISP Stream", desc: "Panasonic Lumix G and S series digital camera sensor data." },
  { ext: "PEF", name: "Pentax Electronic File", category: "raw", engine: "Pentax RAW Parser", desc: "Pentax digital SLR camera RAW image sensor data." },
  { ext: "3FR", name: "Hasselblad 3F RAW", category: "raw", engine: "Medium Format ISP", desc: "Hasselblad high-resolution medium format digital captures." },
  { ext: "FFF", name: "Hasselblad RAW Imacon", category: "raw", engine: "Medium Format ISP", desc: "Hasselblad digital camera back and scanner RAW data." },
  { ext: "SRF", name: "Sony RAW File (Legacy)", category: "raw", engine: "Sony Legacy ISP", desc: "Early Sony Cyber-shot and Alpha DSLR RAW format." },
  { ext: "SR2", name: "Sony RAW 2", category: "raw", engine: "Sony Legacy ISP", desc: "Sony digital SLR secondary RAW format." },
  { ext: "NRW", name: "Nikon Coolpix RAW", category: "raw", engine: "Nikon Compact ISP", desc: "Nikon Coolpix enthusiast compact camera RAW format." },
  { ext: "SRW", name: "Samsung Camera RAW", category: "raw", engine: "Samsung NX Parser", desc: "Samsung NX mirrorless series camera RAW sensor captures." },

  // Design & Pro Graphics
  { ext: "PSD", name: "Adobe Photoshop Document", category: "pro", engine: "ag-psd WebAssembly", desc: "Photoshop multi-layer document merged composite raster." },
  { ext: "PSB", name: "Photoshop Large Document", category: "pro", engine: "ag-psd WebAssembly", desc: "Photoshop canvas format for files exceeding 2 Gigabytes." },
  { ext: "TIFF", name: "Tagged Image File", category: "pro", engine: "UTIF.js Engine", desc: "Professional prepress and multi-channel publication raster." },
  { ext: "TGA", name: "Truevision TARGA", category: "pro", engine: "Binary RLE Stream", desc: "Raster graphics format standard in video games and 3D textures." },
  { ext: "PPM", name: "Portable Pixmap (NetPBM)", category: "pro", engine: "Binary NetPBM Parser", desc: "Uncompressed 24-bit RGB bitmap graphics format." },
  { ext: "PGM", name: "Portable Graymap", category: "pro", engine: "Binary NetPBM Parser", desc: "Grayscale 8-bit / 16-bit uncompressed raster graphics." },

  // Modern & Vector
  { ext: "SVG", name: "Scalable Vector Graphics", category: "web", engine: "Dynamic Vector Scaler", desc: "XML vector image scaled up to 2400px before rasterization." },
  { ext: "SVGZ", name: "Compressed SVG", category: "web", engine: "Vector Scaler", desc: "Gzip compressed Scalable Vector Graphics format." },
  { ext: "HEIC", name: "Apple High Efficiency", category: "web", engine: "heic2any Codec", desc: "High Efficiency Image Container with HEVC compression." },
  { ext: "HEIF", name: "High Efficiency Image Format", category: "web", engine: "heic2any Codec", desc: "Standard ISO image container for high efficiency photos." },
  { ext: "HIF", name: "10-bit HDR Image File", category: "web", engine: "heic2any Codec", desc: "Modern 10-bit HDR photos from modern digital cameras." },

  // Standard Web
  { ext: "WEBP", name: "Google WebP", category: "standard", engine: "Native Canvas Codec", desc: "Modern web format with lossy, lossless, and alpha channels." },
  { ext: "PNG", name: "Portable Network Graphics", category: "standard", engine: "Native Canvas Codec", desc: "Universal lossless raster format supporting 8-bit alpha transparency." },
  { ext: "JPEG", name: "Joint Photographic Experts", category: "standard", engine: "Native Canvas Codec", desc: "Standard photographic compression format used universally." },
  { ext: "AVIF", name: "AV1 Image File Format", category: "standard", engine: "Native / Fallback Codec", desc: "Cutting-edge AV1 intra-frame compression with HDR capability." },
  { ext: "GIF", name: "Graphics Interchange", category: "standard", engine: "Browser Native", desc: "Indexed-color graphic format with 1-bit transparency." },
  { ext: "BMP", name: "Windows Bitmap", category: "standard", engine: "Browser Native", desc: "Standard Windows uncompressed device-independent bitmap." }
];

// --- DOM References ---
const dom = {
  root: document.documentElement,
  mainNav: document.getElementById("mainNav"),
  mobileMenuToggle: document.getElementById("mobileMenuToggle"),
  themeToggle: document.getElementById("themeToggle"),
  openSettings: document.getElementById("openSettings"),
  docsLink: document.getElementById("docsLink"),
  footerDocsBtn: document.getElementById("footerDocsBtn"),
  footerSettingsBtn: document.getElementById("footerSettingsBtn"),
  footerPrivacyBtn: document.getElementById("footerPrivacyBtn"),

  // Views
  views: {
    converter: document.getElementById("view-converter"),
    formats: document.getElementById("view-formats"),
    history: document.getElementById("view-history"),
    api: document.getElementById("view-api")
  },
  navItems: document.querySelectorAll(".nav-item"),

  // Converter Workspace
  triggerDrawerBtn: document.getElementById("triggerDrawerBtn"),
  headerClearQueueBtn: document.getElementById("headerClearQueueBtn"),
  resetSettingsBtn: document.getElementById("resetSettingsBtn"),
  formatPills: document.querySelectorAll(".format-pill"),
  formatHint: document.getElementById("formatHint"),
  qualityRange: document.getElementById("qualityRange"),
  qualityValue: document.getElementById("qualityValue"),
  presetBtns: document.querySelectorAll(".preset-btn"),
  autoOptimize: document.getElementById("autoOptimize"),
  preserveMetadata: document.getElementById("preserveMetadata"),

  // Upload
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("fileInput"),
  folderUploadTrigger: document.getElementById("folderUploadTrigger"),
  folderInput: document.getElementById("folderInput"),
  loadSampleBtn: document.getElementById("loadSampleBtn"),

  // Preview & Comparison
  previewBadge: document.getElementById("previewBadge"),
  previewTitle: document.getElementById("previewTitle"),
  toggleCompareMode: document.getElementById("toggleCompareMode"),
  toggleCheckerboard: document.getElementById("toggleCheckerboard"),
  openFullscreenPreview: document.getElementById("openFullscreenPreview"),
  downloadSelected: document.getElementById("downloadSelected"),
  comparisonStage: document.getElementById("comparisonStage"),
  comparisonWrapper: document.getElementById("comparisonWrapper"),
  beforeImage: document.getElementById("beforeImage"),
  afterLayer: document.getElementById("afterLayer"),
  afterImage: document.getElementById("afterImage"),
  compareHandle: document.getElementById("compareHandle"),
  compareRange: document.getElementById("compareRange"),
  afterFormatTag: document.getElementById("afterFormatTag"),
  sideBySideWrapper: document.getElementById("sideBySideWrapper"),
  sideOriginalExt: document.getElementById("sideOriginalExt"),
  sideBeforeImage: document.getElementById("sideBeforeImage"),
  sideAfterExt: document.getElementById("sideAfterExt"),
  sideAfterImage: document.getElementById("sideAfterImage"),
  emptyState: document.getElementById("emptyState"),

  // Comparison Meta Bar
  selectedOriginal: document.getElementById("selectedOriginal"),
  selectedOrigDim: document.getElementById("selectedOrigDim"),
  metaOutputFormatLabel: document.getElementById("metaOutputFormatLabel"),
  selectedOutput: document.getElementById("selectedOutput"),
  selectedOutDim: document.getElementById("selectedOutDim"),
  selectedSaved: document.getElementById("selectedSaved"),
  selectedSavedBytes: document.getElementById("selectedSavedBytes"),

  // Queue Section
  queueCountBadge: document.getElementById("queueCountBadge"),
  selectAllBtn: document.getElementById("selectAllBtn"),
  removeSelectedBtn: document.getElementById("removeSelectedBtn"),
  pauseQueueBtn: document.getElementById("pauseQueueBtn"),
  retryFailedBtn: document.getElementById("retryFailedBtn"),
  clearQueueBtn: document.getElementById("clearQueueBtn"),
  downloadZip: document.getElementById("downloadZip"),
  batchProgressWrapper: document.getElementById("batchProgressWrapper"),
  batchProgressLabel: document.getElementById("batchProgressLabel"),
  batchProgressPercent: document.getElementById("batchProgressPercent"),
  batchProgressBarFill: document.getElementById("batchProgressBarFill"),
  queueList: document.getElementById("queueList"),

  // Live Statistics
  totalFiles: document.getElementById("totalFiles"),
  statQueuePending: document.getElementById("statQueuePending"),
  completedFiles: document.getElementById("completedFiles"),
  failedFiles: document.getElementById("failedFiles"),
  totalOriginalSize: document.getElementById("totalOriginalSize"),
  totalOutput: document.getElementById("totalOutput"),
  totalSavedBytes: document.getElementById("totalSavedBytes"),
  totalSavedPercent: document.getElementById("totalSavedPercent"),

  // Advanced Settings Drawer
  drawerOverlay: document.getElementById("drawerOverlay"),
  advancedDrawer: document.getElementById("advancedDrawer"),
  drawerCloseBtn: document.getElementById("drawerCloseBtn"),
  drawerResetBtn: document.getElementById("drawerResetBtn"),
  drawerApplyBtn: document.getElementById("drawerApplyBtn"),
  maxWidthInput: document.getElementById("maxWidthInput"),
  maxHeightInput: document.getElementById("maxHeightInput"),
  maintainAspect: document.getElementById("maintainAspect"),
  stripGps: document.getElementById("stripGps"),
  preserveIcc: document.getElementById("preserveIcc"),
  namingPattern: document.getElementById("namingPattern"),
  customPrefixGroup: document.getElementById("customPrefixGroup"),
  customPrefixInput: document.getElementById("customPrefixInput"),
  drawerConcurrencySelect: document.getElementById("drawerConcurrencySelect"),

  // Formats View
  formatSearchInput: document.getElementById("formatSearchInput"),
  formatCatBtns: document.querySelectorAll(".format-cat-btn"),
  formatsGrid: document.getElementById("formatsGrid"),

  // History View
  historySearchInput: document.getElementById("historySearchInput"),
  exportHistoryBtn: document.getElementById("exportHistoryBtn"),
  clearHistory: document.getElementById("clearHistory"),
  historyTotalCount: document.getElementById("historyTotalCount"),
  historyOrigTotal: document.getElementById("historyOrigTotal"),
  historyOutTotal: document.getElementById("historyOutTotal"),
  historySavedTotal: document.getElementById("historySavedTotal"),
  historyList: document.getElementById("historyList"),

  // Developer API View
  copyApiCodeBtn: document.getElementById("copyApiCodeBtn"),
  apiCodeBlock: document.getElementById("apiCodeBlock"),

  // Dialogs
  settingsDialog: document.getElementById("settingsDialog"),
  defaultFormatSelect: document.getElementById("defaultFormatSelect"),
  concurrencySelect: document.getElementById("concurrencySelect"),
  themeSelect: document.getElementById("themeSelect"),
  saveHistoryToggle: document.getElementById("saveHistoryToggle"),
  purgeDataBtn: document.getElementById("purgeDataBtn"),
  diagOffscreen: document.getElementById("diagOffscreen"),
  diagWasm: document.getElementById("diagWasm"),
  diagAvif: document.getElementById("diagAvif"),

  previewModal: document.getElementById("previewModal"),
  modalFormatBadge: document.getElementById("modalFormatBadge"),
  previewModalTitle: document.getElementById("previewModalTitle"),
  modalDimLabel: document.getElementById("modalDimLabel"),
  modalPrevBtn: document.getElementById("modalPrevBtn"),
  modalNextBtn: document.getElementById("modalNextBtn"),
  modalZoomOut: document.getElementById("modalZoomOut"),
  modalZoomLevel: document.getElementById("modalZoomLevel"),
  modalZoomIn: document.getElementById("modalZoomIn"),
  modalZoomReset: document.getElementById("modalZoomReset"),
  modalImageViewport: document.getElementById("modalImageViewport"),
  modalInspectImage: document.getElementById("modalInspectImage"),
  modalExifBar: document.getElementById("modalExifBar"),
  exifCamera: document.getElementById("exifCamera"),
  exifLens: document.getElementById("exifLens"),
  exifSpecs: document.getElementById("exifSpecs"),

  docsModal: document.getElementById("docsModal"),
  toastContainer: document.getElementById("toastContainer")
};

// --- Application State ---
const state = {
  currentTab: "converter",
  items: [],
  selectedId: null,
  targetFormat: "webp",
  quality: 82,
  concurrency: 3,
  isPaused: false,
  compareMode: "split", // 'split' | 'side'
  isCheckerboard: false,
  modalZoom: 100,
  conversionVersion: 0,
  draggedId: null,
  activeFormatCat: "all",
  saveHistory: true,
  settings: {
    defaultFormat: "webp",
    concurrency: 3,
    theme: "system",
    saveHistory: true
  }
};

const scriptCache = new Map();

// --- Initialization ---
loadSavedSettings();
initTheme();
initRouting();
renderFormatCatalog();
bindAllEvents();
renderHistory();
syncCompare();
render();
runDiagnostics();

// Export Global SDK API
window.FluxWebP = {
  convertFile,
  getSupportedFormats: () => FORMAT_CATALOG,
  getQueue: () => [...state.items]
};

// --- Routing & Tab Management ---
function initRouting() {
  window.addEventListener("hashchange", handleHashChange);
  handleHashChange();
}

function handleHashChange() {
  const hash = window.location.hash.replace("#/", "").replace("#", "").toLowerCase() || "converter";
  const validTabs = ["converter", "formats", "history", "api"];
  const target = validTabs.includes(hash) ? hash : "converter";
  switchTab(target);
}

function switchTab(tabName) {
  state.currentTab = tabName;

  // Update Navigation Active State
  dom.navItems.forEach((item) => {
    const isTarget = item.dataset.tab === tabName;
    item.classList.toggle("active", isTarget);
    if (isTarget) {
      item.setAttribute("aria-current", "page");
    } else {
      item.removeAttribute("aria-current");
    }
  });

  // Switch View Containers
  Object.keys(dom.views).forEach((key) => {
    const view = dom.views[key];
    if (view) {
      if (key === tabName) {
        view.classList.remove("hidden");
        requestAnimationFrame(() => view.classList.add("active"));
      } else {
        view.classList.remove("active");
        view.classList.add("hidden");
      }
    }
  });

  // Close mobile navigation drawer if open
  dom.mainNav?.classList.remove("nav-open");
  dom.mobileMenuToggle?.setAttribute("aria-expanded", "false");

  // Rerender tab-specific content if needed
  if (tabName === "history") renderHistory();
  if (tabName === "formats") filterFormatsCatalog();
}

// --- Settings & Storage Management ---
function loadSavedSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      state.settings = { ...state.settings, ...JSON.parse(raw) };
    }
  } catch (_) {}

  state.targetFormat = state.settings.defaultFormat || "webp";
  state.concurrency = Number(state.settings.concurrency) || 3;
  state.saveHistory = state.settings.saveHistory !== false;

  if (dom.defaultFormatSelect) dom.defaultFormatSelect.value = state.targetFormat;
  if (dom.concurrencySelect) dom.concurrencySelect.value = String(state.concurrency);
  if (dom.drawerConcurrencySelect) dom.drawerConcurrencySelect.value = String(state.concurrency);
  if (dom.saveHistoryToggle) dom.saveHistoryToggle.checked = state.saveHistory;

  updateFormatPillsUI(state.targetFormat);
}

function saveSettings() {
  state.settings = {
    defaultFormat: dom.defaultFormatSelect.value,
    concurrency: Number(dom.concurrencySelect.value),
    theme: dom.themeSelect.value,
    saveHistory: dom.saveHistoryToggle.checked
  };
  state.targetFormat = state.settings.defaultFormat;
  state.concurrency = state.settings.concurrency;
  state.saveHistory = state.settings.saveHistory;

  if (dom.drawerConcurrencySelect) dom.drawerConcurrencySelect.value = String(state.concurrency);
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  updateFormatPillsUI(state.targetFormat);
  scheduleReconvert();
  showToast("Preferences saved.");
}

function purgeAllData() {
  localStorage.removeItem(SETTINGS_KEY);
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem(THEME_KEY);

  // Clear queue
  state.items.forEach((item) => {
    URL.revokeObjectURL(item.originalUrl);
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
  });
  state.items = [];
  state.selectedId = null;

  dom.settingsDialog.close();
  render();
  renderHistory();
  showToast("All local cache and storage cleared successfully.");
}

// --- Theme Management ---
function initTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  const theme = stored || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  dom.root.dataset.theme = theme;
  if (dom.themeSelect) dom.themeSelect.value = stored ? theme : "system";
}

function toggleTheme() {
  const current = dom.root.dataset.theme === "dark" ? "dark" : "light";
  const next = current === "dark" ? "light" : "dark";
  dom.root.dataset.theme = next;
  localStorage.setItem(THEME_KEY, next);
  if (dom.themeSelect) dom.themeSelect.value = next;
  showToast(`Switched to ${next} theme.`);
}

function handleThemeSelectChange() {
  const val = dom.themeSelect.value;
  if (val === "system") {
    localStorage.removeItem(THEME_KEY);
    initTheme();
  } else {
    dom.root.dataset.theme = val;
    localStorage.setItem(THEME_KEY, val);
  }
}

// --- Body Scroll Lock Manager ---
function lockBodyScroll(locked) {
  if (locked) {
    document.body.classList.add("modal-open");
    document.body.style.overflow = "hidden";
  } else {
    const hasOpenModal = document.querySelector("dialog[open]") || dom.advancedDrawer?.classList.contains("open") || dom.mainNav?.classList.contains("nav-open");
    if (!hasOpenModal) {
      document.body.classList.remove("modal-open");
      document.body.style.overflow = "";
    }
  }
}

function openModal(dialog) {
  if (!dialog) return;
  dialog.showModal();
  lockBodyScroll(true);
}

// --- Drawer Management ---
function openDrawer() {
  dom.drawerOverlay.classList.add("open");
  dom.advancedDrawer.classList.add("open");
  dom.advancedDrawer.setAttribute("aria-hidden", "false");
  lockBodyScroll(true);
}

function closeDrawer() {
  dom.drawerOverlay.classList.remove("open");
  dom.advancedDrawer.classList.remove("open");
  dom.advancedDrawer.setAttribute("aria-hidden", "true");
  lockBodyScroll(false);
}

// --- Event Binding ---
function bindAllEvents() {
  // Mobile Navigation
  dom.mobileMenuToggle?.addEventListener("click", () => {
    const isOpen = dom.mainNav.classList.toggle("nav-open");
    dom.mobileMenuToggle.setAttribute("aria-expanded", String(isOpen));
    lockBodyScroll(isOpen);
  });

  // Theme & Settings Triggers
  dom.themeToggle?.addEventListener("click", toggleTheme);
  dom.openSettings?.addEventListener("click", () => openModal(dom.settingsDialog));
  dom.footerSettingsBtn?.addEventListener("click", () => openModal(dom.settingsDialog));
  dom.docsLink?.addEventListener("click", () => openModal(dom.docsModal));
  dom.footerDocsBtn?.addEventListener("click", () => openModal(dom.docsModal));
  dom.footerPrivacyBtn?.addEventListener("click", () => {
    switchTab("converter");
    const privacy = document.getElementById("privacy");
    privacy?.scrollIntoView({ behavior: "smooth" });
  });

  wireDialogBackdrop(dom.settingsDialog);
  wireDialogBackdrop(dom.previewModal);
  wireDialogBackdrop(dom.docsModal);

  dom.settingsDialog?.querySelector("form[method='dialog'] button[value='save']")?.addEventListener("click", saveSettings);
  dom.themeSelect?.addEventListener("change", handleThemeSelectChange);
  dom.purgeDataBtn?.addEventListener("click", purgeAllData);

  // Drawer Triggers
  dom.triggerDrawerBtn?.addEventListener("click", openDrawer);
  dom.drawerCloseBtn?.addEventListener("click", closeDrawer);
  dom.drawerOverlay?.addEventListener("click", closeDrawer);
  dom.drawerApplyBtn?.addEventListener("click", () => {
    closeDrawer();
    scheduleReconvert();
    showToast("Advanced settings applied.");
  });
  dom.drawerResetBtn?.addEventListener("click", resetSettingsToDefaults);

  // Clear Queue Shortcut
  dom.headerClearQueueBtn?.addEventListener("click", clearQueue);

  // File Uploads
  dom.fileInput?.addEventListener("change", (e) => addFiles(e.target.files));
  dom.folderUploadTrigger?.addEventListener("click", () => dom.folderInput.click());
  dom.folderInput?.addEventListener("change", (e) => addFiles(e.target.files));
  dom.loadSampleBtn?.addEventListener("click", loadSampleImage);

  // Drag & Drop
  ["dragenter", "dragover"].forEach((evt) => {
    dom.dropzone?.addEventListener(evt, (e) => {
      e.preventDefault();
      dom.dropzone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((evt) => {
    dom.dropzone?.addEventListener(evt, (e) => {
      e.preventDefault();
      dom.dropzone.classList.remove("dragover");
    });
  });

  dom.dropzone?.addEventListener("drop", (e) => {
    addFiles(e.dataTransfer.files);
  });

  // Clipboard Paste Support (Ctrl+V)
  window.addEventListener("paste", handleClipboardPaste);

  // Target Format Selection
  dom.formatPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      const format = pill.dataset.format;
      if (!format) return;
      setTargetFormat(format);
    });
  });

  // Quality Range & Presets
  dom.qualityRange?.addEventListener("input", handleQualityRangeChange);
  dom.presetBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const q = Number(btn.dataset.quality);
      if (!Number.isNaN(q)) setQuality(q);
    });
  });

  // Toggles
  dom.autoOptimize?.addEventListener("change", handleAutoOptimizeToggle);
  dom.preserveMetadata?.addEventListener("change", () => scheduleReconvert());
  dom.resetSettingsBtn?.addEventListener("click", resetSettingsToDefaults);

  // Drawer Settings
  dom.maxWidthInput?.addEventListener("change", () => scheduleReconvert());
  dom.maxHeightInput?.addEventListener("change", () => scheduleReconvert());
  dom.maintainAspect?.addEventListener("change", () => scheduleReconvert());
  dom.stripGps?.addEventListener("change", () => scheduleReconvert());
  dom.preserveIcc?.addEventListener("change", () => scheduleReconvert());
  dom.drawerConcurrencySelect?.addEventListener("change", (e) => {
    state.concurrency = Number(e.target.value) || 3;
    if (dom.concurrencySelect) dom.concurrencySelect.value = String(state.concurrency);
  });

  dom.namingPattern?.addEventListener("change", () => {
    const isCustom = dom.namingPattern.value === "custom_prefix";
    dom.customPrefixGroup?.classList.toggle("hidden", !isCustom);
    renderQueue();
  });
  dom.customPrefixInput?.addEventListener("input", () => renderQueue());

  // Comparison View Mode
  dom.compareRange?.addEventListener("input", syncCompare);
  dom.toggleCompareMode?.addEventListener("click", toggleCompareMode);
  dom.toggleCheckerboard?.addEventListener("click", toggleCheckerboard);
  dom.openFullscreenPreview?.addEventListener("click", openFullscreenInspector);
  dom.downloadSelected?.addEventListener("click", downloadSelected);

  // Fullscreen Inspector Navigation & Zoom
  dom.modalPrevBtn?.addEventListener("click", navigateInspectorPrev);
  dom.modalNextBtn?.addEventListener("click", navigateInspectorNext);
  dom.modalZoomIn?.addEventListener("click", () => adjustModalZoom(25));
  dom.modalZoomOut?.addEventListener("click", () => adjustModalZoom(-25));
  dom.modalZoomReset?.addEventListener("click", () => setModalZoom(100));

  // Batch Queue Actions
  dom.selectAllBtn?.addEventListener("click", toggleSelectAllQueue);
  dom.removeSelectedBtn?.addEventListener("click", removeSelectedQueueItems);
  dom.pauseQueueBtn?.addEventListener("click", togglePauseQueue);
  dom.retryFailedBtn?.addEventListener("click", retryFailedQueueItems);
  dom.clearQueueBtn?.addEventListener("click", clearQueue);
  dom.downloadZip?.addEventListener("click", downloadAllAsZip);

  // Format Catalog Filters
  dom.formatSearchInput?.addEventListener("input", filterFormatsCatalog);
  dom.formatCatBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      dom.formatCatBtns.forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      state.activeFormatCat = btn.dataset.cat || "all";
      filterFormatsCatalog();
    });
  });

  // API Code Copy
  dom.copyApiCodeBtn?.addEventListener("click", copyApiSnippet);

  // History Actions
  dom.historySearchInput?.addEventListener("input", renderHistory);
  dom.exportHistoryBtn?.addEventListener("click", exportHistoryToJson);
  dom.clearHistory?.addEventListener("click", clearHistory);

  // History individual item delete
  dom.historyList?.addEventListener("click", (e) => {
    const btn = e.target.closest('button[data-action="delete-history"]');
    if (!btn) return;
    const idx = Number(btn.dataset.index);
    const history = getHistory();
    if (idx >= 0 && idx < history.length) {
      history.splice(idx, 1);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      renderHistory();
      showToast("History entry removed.");
    }
  });

  // API Documentation Navigation links smooth scrolling
  document.querySelectorAll(".api-nav-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href");
      if (href && href.startsWith("#api-")) {
        e.preventDefault();
        const targetEl = document.querySelector(href);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
          document.querySelectorAll(".api-nav-link").forEach((l) => l.classList.remove("active"));
          link.classList.add("active");
        }
      }
    });
  });

  // Touch comparison slider
  initTouchComparison();
}

function initTouchComparison() {
  const stage = dom.comparisonStage;
  if (!stage) return;

  function handleTouch(e) {
    if (state.compareMode !== "split") return;
    const touch = e.touches[0];
    if (!touch) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = touch.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, Math.round((x / rect.width) * 100)));
    dom.compareRange.value = String(percentage);
    syncCompare();
  }

  stage.addEventListener("touchstart", handleTouch, { passive: true });
  stage.addEventListener("touchmove", handleTouch, { passive: true });
}

function wireDialogBackdrop(dialog) {
  if (!dialog) return;
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => {
    lockBodyScroll(false);
  });
}

// --- Diagnostics Verification ---
function runDiagnostics() {
  if (dom.diagOffscreen) {
    dom.diagOffscreen.textContent = "OffscreenCanvas" in window ? "Supported (Hardware Accelerated)" : "Fallback to Canvas 2D";
    dom.diagOffscreen.className = "text-green";
  }
  if (dom.diagWasm) {
    dom.diagWasm.textContent = typeof WebAssembly === "object" ? "Supported" : "Unavailable";
    dom.diagWasm.className = "text-green";
  }
  if (dom.diagAvif) {
    const c = document.createElement("canvas");
    c.width = 1; c.height = 1;
    if ("convertToBlob" in c) {
      c.convertToBlob({ type: "image/avif" })
        .then(() => {
          if (dom.diagAvif) {
            dom.diagAvif.textContent = "Native Canvas Supported";
            dom.diagAvif.className = "text-green";
          }
        })
        .catch(() => {
          if (dom.diagAvif) {
            dom.diagAvif.textContent = "Fallback to WebP";
            dom.diagAvif.className = "text-secondary";
          }
        });
    } else {
      if (dom.diagAvif) {
        dom.diagAvif.textContent = "Fallback to WebP";
        dom.diagAvif.className = "text-secondary";
      }
    }
  }
}

// --- Clipboard Paste Handler ---
function handleClipboardPaste(event) {
  const items = event.clipboardData?.items;
  if (!items || !items.length) return;

  const files = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === "file") {
      const file = item.getAsFile();
      if (file && isAcceptedImage(file)) {
        files.push(file);
      }
    }
  }

  if (files.length) {
    addFiles(files);
    showToast(`Pasted ${files.length} image${files.length === 1 ? "" : "s"} from clipboard.`);
  }
}

// --- Target Format & Quality Handling ---
function setTargetFormat(format) {
  state.targetFormat = format;
  updateFormatPillsUI(format);

  if (format === "png") {
    dom.formatHint.textContent = "PNG: Universal lossless compression with full alpha channel support.";
    dom.qualityRange.disabled = true;
    dom.qualityValue.textContent = "100";
  } else if (format === "jpeg") {
    dom.formatHint.textContent = "JPEG: Universal photographic standard. No alpha transparency support.";
    dom.qualityRange.disabled = false;
    dom.qualityValue.textContent = state.quality;
  } else if (format === "avif") {
    dom.formatHint.textContent = "AVIF: Next-gen AV1 codec offering highest dynamic range & compression efficiency.";
    dom.qualityRange.disabled = false;
    dom.qualityValue.textContent = state.quality;
  } else {
    dom.formatHint.textContent = "WebP: Recommended modern format delivering ~35% smaller files than JPEG.";
    dom.qualityRange.disabled = false;
    dom.qualityValue.textContent = state.quality;
  }

  dom.afterFormatTag.textContent = format.toUpperCase();
  dom.sideAfterExt.textContent = format.toUpperCase();
  dom.metaOutputFormatLabel.textContent = `Optimized ${format.toUpperCase()}`;

  scheduleReconvert();
}

function updateFormatPillsUI(activeFormat) {
  dom.formatPills.forEach((p) => {
    const match = p.dataset.format === activeFormat;
    p.classList.toggle("active", match);
    p.setAttribute("aria-checked", match ? "true" : "false");
  });
}

function handleQualityRangeChange() {
  const q = Number(dom.qualityRange.value);
  setQuality(q);
}

function setQuality(q) {
  state.quality = clamp(q, 5, 100);
  dom.qualityRange.value = String(state.quality);
  dom.qualityValue.textContent = state.quality;

  dom.presetBtns.forEach((btn) => {
    const btnQ = Number(btn.dataset.quality);
    btn.classList.toggle("active", btnQ === state.quality);
  });

  scheduleReconvert();
}

function handleAutoOptimizeToggle() {
  if (dom.autoOptimize.checked) {
    applyAutoOptimize();
  } else {
    scheduleReconvert();
  }
}

function applyAutoOptimize() {
  if (!state.items.length) {
    showToast("Auto optimize active. Upload images to evaluate.");
    return;
  }

  const hasLargeFile = state.items.some((item) => item.originalSize > 4_000_000);
  const hasTransparent = state.items.some((item) => /png|svg|webp/i.test(item.file.type) || /\.(png|svg)$/i.test(item.name));
  const hasRaw = state.items.some((item) => RAW_EXTENSIONS.has(getExtension(item.name)));

  let optimalFormat = "webp";
  let optimalQuality = 82;

  if (hasTransparent) {
    optimalFormat = "webp";
    optimalQuality = 88;
  } else if (hasRaw || hasLargeFile) {
    optimalFormat = "webp";
    optimalQuality = 78;
  }

  setTargetFormat(optimalFormat);
  setQuality(optimalQuality);
  showToast(`Auto Optimize configured ${optimalFormat.toUpperCase()} at ${optimalQuality}% quality.`);
}

function resetSettingsToDefaults() {
  setTargetFormat("webp");
  setQuality(82);
  if (dom.autoOptimize) dom.autoOptimize.checked = false;
  if (dom.preserveMetadata) dom.preserveMetadata.checked = true;
  if (dom.maintainAspect) dom.maintainAspect.checked = true;
  if (dom.maxWidthInput) dom.maxWidthInput.value = "";
  if (dom.maxHeightInput) dom.maxHeightInput.value = "";
  if (dom.namingPattern) dom.namingPattern.value = "name_clean";
  if (dom.customPrefixGroup) dom.customPrefixGroup.classList.add("hidden");
  if (dom.customPrefixInput) dom.customPrefixInput.value = "";
  if (dom.stripGps) dom.stripGps.checked = true;
  if (dom.preserveIcc) dom.preserveIcc.checked = true;

  scheduleReconvert();
  showToast("Settings reset to balanced production defaults.");
}

// --- Comparison View Mode & Inspector ---
function syncCompare() {
  const value = Number(dom.compareRange.value);
  const fraction = Math.max(0.01, Math.min(1, value / 100));
  dom.afterLayer.style.width = `${value}%`;
  dom.afterLayer.style.setProperty("--compare-width", String(fraction));
  dom.compareHandle.style.left = `${value}%`;
}

function toggleCompareMode() {
  state.compareMode = state.compareMode === "split" ? "side" : "split";
  const isSplit = state.compareMode === "split";

  dom.comparisonWrapper.classList.toggle("hidden", !isSplit);
  dom.sideBySideWrapper.classList.toggle("hidden", isSplit);

  const span = dom.toggleCompareMode.querySelector("span");
  if (span) span.textContent = isSplit ? "Side-by-Side" : "Split View";

  renderPreview();
}

function toggleCheckerboard() {
  state.isCheckerboard = !state.isCheckerboard;
  dom.comparisonStage.classList.toggle("checkerboard-bg", state.isCheckerboard);
  dom.modalImageViewport.classList.toggle("checkerboard-bg", state.isCheckerboard);

  const sideViews = dom.sideBySideWrapper.querySelectorAll(".side-view");
  sideViews.forEach((view) => view.classList.toggle("checkerboard-bg", state.isCheckerboard));
}

function openFullscreenInspector() {
  const selected = findItem(state.selectedId);
  if (!selected) return;

  dom.modalFormatBadge.textContent = getExtension(selected.name).toUpperCase() || "IMG";
  dom.previewModalTitle.textContent = selected.name;
  dom.modalDimLabel.textContent = selected.width && selected.height ? `${selected.width} × ${selected.height} px` : "Dimensions Pending";

  dom.modalInspectImage.src = selected.outputUrl || selected.previewUrl || selected.originalUrl;
  setModalZoom(100);

  // Metadata pills
  const ext = getExtension(selected.name).toUpperCase();
  dom.exifCamera.textContent = RAW_EXTENSIONS.has(ext.toLowerCase()) ? `Sensor: ${ext} Camera RAW` : `Format: ${ext}`;
  dom.exifLens.textContent = `File Size: ${formatBytes(selected.originalSize)}`;
  dom.exifSpecs.textContent = selected.width ? `${selected.width} × ${selected.height} px • sRGB` : "Resolution: Pending";

  openModal(dom.previewModal);
}

function navigateInspectorPrev() {
  if (!state.items.length) return;
  const idx = state.items.findIndex((i) => i.id === state.selectedId);
  const prevIdx = idx > 0 ? idx - 1 : state.items.length - 1;
  state.selectedId = state.items[prevIdx].id;
  renderPreview();
  renderQueue();
  openFullscreenInspector();
}

function navigateInspectorNext() {
  if (!state.items.length) return;
  const idx = state.items.findIndex((i) => i.id === state.selectedId);
  const nextIdx = idx < state.items.length - 1 ? idx + 1 : 0;
  state.selectedId = state.items[nextIdx].id;
  renderPreview();
  renderQueue();
  openFullscreenInspector();
}

function adjustModalZoom(delta) {
  setModalZoom(state.modalZoom + delta);
}

function setModalZoom(val) {
  state.modalZoom = clamp(val, 25, 400);
  dom.modalZoomLevel.textContent = `${state.modalZoom}%`;
  dom.modalInspectImage.style.transform = `scale(${state.modalZoom / 100})`;
}

// --- File Addition & Validation ---
function addFiles(fileList) {
  const incoming = Array.from(fileList || []);
  if (!incoming.length) return;

  const validFiles = [];
  let skipped = 0;

  incoming.forEach((file) => {
    if (file.size === 0) {
      skipped++;
      return;
    }
    if (file.size > 250_000_000) {
      showToast(`Skipped ${file.name} (exceeds 250MB browser limit).`);
      skipped++;
      return;
    }
    if (!isAcceptedImage(file)) {
      skipped++;
      return;
    }
    validFiles.push(file);
  });

  if (skipped > 0) {
    showToast(`${skipped} unsupported or empty file${skipped === 1 ? "" : "s"} skipped.`);
  }

  if (!validFiles.length) return;

  const newItems = validFiles.map((file) => {
    const id = makeId();
    return {
      id,
      file,
      name: file.name || `image-${id}`,
      originalSize: file.size,
      originalUrl: URL.createObjectURL(file),
      previewBlob: null,
      previewUrl: "",
      outputBlob: null,
      outputUrl: "",
      outputSize: 0,
      savedPercent: 0,
      savedBytes: 0,
      status: "queued",
      progress: 0,
      error: "",
      width: 0,
      height: 0,
      selectedForBatch: false
    };
  });

  state.items.push(...newItems);
  if (!state.selectedId) state.selectedId = newItems[0].id;

  render();
  processQueue();
}

function isAcceptedImage(file) {
  if (!file) return false;
  const ext = getExtension(file.name);
  return (
    file.type.startsWith("image/") ||
    ACCEPTED_EXTENSIONS.has(ext) ||
    RAW_EXTENSIONS.has(ext) ||
    /raw|photoshop|arw|cr2|cr3|nef|dng|raf|orf|rw2|tiff|heic/i.test(file.type)
  );
}

function getExtension(name = "") {
  const clean = name.split("?")[0].split("#")[0];
  const parts = clean.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

function getFormatClass(name = "") {
  const ext = getExtension(name);
  if (RAW_EXTENSIONS.has(ext)) return "raw";
  if (["psd", "psb", "tif", "tiff", "tga", "targa", "ppm", "pgm"].includes(ext)) return "pro";
  if (["heic", "heif", "hif", "svg", "svgz"].includes(ext)) return "web";
  return "standard";
}

// --- Queue Engine & Concurrency Control ---
function scheduleReconvert() {
  window.clearTimeout(scheduleReconvert.timer);
  scheduleReconvert.timer = window.setTimeout(() => {
    state.items.forEach((item) => {
      if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
      item.outputBlob = null;
      item.outputUrl = "";
      item.outputSize = 0;
      item.savedPercent = 0;
      item.savedBytes = 0;
      item.status = "queued";
      item.progress = 0;
      item.error = "";
    });
    render();
    processQueue();
  }, 220);
}

async function processQueue() {
  if (state.isPaused || !state.items.length) return;

  const version = ++state.conversionVersion;
  const pending = state.items.filter((item) => item.status === "queued");
  if (!pending.length) return;

  const concurrency = Math.min(state.concurrency, pending.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < pending.length) {
      if (state.isPaused || version !== state.conversionVersion) break;
      const item = pending[cursor];
      cursor++;
      await convertItem(item, version);
    }
  };

  const pool = Array.from({ length: concurrency }, () => worker());
  await Promise.allSettled(pool);

  if (version === state.conversionVersion) {
    render();
  }
}

async function convertItem(item, version) {
  item.status = "converting";
  item.progress = 15;
  item.error = "";
  renderQueueItem(item.id);
  updateStats();

  try {
    await waitFrame();
    item.progress = 40;
    renderQueueItem(item.id);

    const resizeOpts = {
      maxWidth: Number(dom.maxWidthInput?.value) || 0,
      maxHeight: Number(dom.maxHeightInput?.value) || 0,
      maintainAspect: dom.maintainAspect?.checked !== false
    };

    const result = await convertFile(item.file, {
      format: state.targetFormat,
      quality: state.quality,
      preserveMetadata: dom.preserveMetadata.checked,
      stripGps: dom.stripGps.checked,
      resize: resizeOpts
    });

    if (version !== state.conversionVersion) return;

    if (result.previewBlob && !item.previewUrl) {
      item.previewBlob = result.previewBlob;
      item.previewUrl = URL.createObjectURL(result.previewBlob);
    }

    item.width = result.width;
    item.height = result.height;
    item.outputBlob = result.blob;
    item.outputUrl = URL.createObjectURL(result.blob);
    item.outputSize = result.blob.size;
    item.savedPercent = result.savedPercent;
    item.savedBytes = result.savedBytes;
    item.status = "done";
    item.progress = 100;

    if (state.saveHistory) {
      addHistory(item);
    }
  } catch (error) {
    if (version !== state.conversionVersion) return;
    item.status = "error";
    item.progress = 100;
    item.error = explainError(error, item.file);
  }

  render();
}

// --- Universal Conversion Implementation ---
async function convertFile(file, options = {}) {
  const targetFormat = options.format || "webp";
  const quality = clamp(Number(options.quality ?? 82), 5, 100) / 100;

  // 1. Universal Decoding
  const decoded = await decodeImage(file);

  // 2. High-Quality Canvas Rasterization & Dimension Constraints
  const { canvas, width, height } = drawToCanvas(decoded.source, decoded.width, decoded.height, options.resize || {});

  // 3. Multi-Format Canvas Encoding
  const blob = await canvasToFormat(canvas, targetFormat, quality);

  // 4. EXIF Injection
  const finalBlob = options.preserveMetadata
    ? await tryPreserveExif(file, blob, targetFormat, width, height, options.stripGps)
    : blob;

  disposeDecoded(decoded.source);

  const savedBytes = Math.max(0, file.size - finalBlob.size);
  const savedPercent = calculateSaved(file.size, finalBlob.size);

  return {
    blob: finalBlob,
    previewBlob: decoded.previewBlob || null,
    width,
    height,
    originalSize: file.size,
    outputSize: finalBlob.size,
    savedBytes,
    savedPercent,
    format: targetFormat
  };
}

// --- Decoding Engine for 30+ Formats ---
async function decodeImage(file) {
  const ext = getExtension(file.name);

  // 1. Camera RAW Formats
  if (RAW_EXTENSIONS.has(ext) || /raw|arw|cr2|cr3|nef|dng|raf|orf|rw2/i.test(file.type)) {
    try {
      return await decodeRawImage(file);
    } catch (rawError) {
      try {
        return await decodeTiff(file);
      } catch (_) {
        try {
          return await decodeBrowserImage(file);
        } catch (_) {
          throw new Error("raw-codec-failed", { cause: rawError });
        }
      }
    }
  }

  // 2. Scalable Vector Graphics (SVG)
  if (ext === "svg" || ext === "svgz" || /svg/i.test(file.type)) {
    try {
      return await decodeSvg(file);
    } catch (svgError) {
      throw new Error("svg-codec-failed", { cause: svgError });
    }
  }

  // 3. Adobe Photoshop Document (PSD / PSB)
  if (ext === "psd" || ext === "psb" || /photoshop/i.test(file.type)) {
    try {
      return await decodePsd(file);
    } catch (psdError) {
      throw new Error("psd-codec-failed", { cause: psdError });
    }
  }

  // 4. Truevision TGA
  if (ext === "tga" || ext === "targa") {
    try {
      return await decodeTga(file);
    } catch (tgaError) {
      throw new Error("tga-codec-failed", { cause: tgaError });
    }
  }

  // 5. NetPBM (PPM, PGM, PBM, PNM)
  if (ext === "ppm" || ext === "pgm" || ext === "pbm" || ext === "pnm") {
    try {
      return await decodeNetPbm(file);
    } catch (pbmError) {
      throw new Error("pbm-codec-failed", { cause: pbmError });
    }
  }

  // 6. High Efficiency Image Container (HEIC / HEIF / HIF)
  if (ext === "heic" || ext === "heif" || ext === "hif" || /hei[cf]/i.test(file.type)) {
    try {
      return await decodeHeic(file);
    } catch (codecError) {
      try {
        return await decodeBrowserImage(file);
      } catch (_) {
        throw new Error("heic-codec-failed", { cause: codecError });
      }
    }
  }

  // 7. Tagged Image File Format (TIFF / TIF)
  if (ext === "tif" || ext === "tiff" || /tiff/i.test(file.type)) {
    try {
      return await decodeTiff(file);
    } catch (codecError) {
      try {
        return await decodeRawImage(file);
      } catch (_) {
        try {
          return await decodeBrowserImage(file);
        } catch (_) {
          throw new Error("tiff-codec-failed", { cause: codecError });
        }
      }
    }
  }

  // 8. Standard Browser Graphics (JPG, PNG, GIF, BMP, WEBP, AVIF, ICO, CUR)
  return decodeBrowserImage(file);
}

// --- RAW Image Extraction Engine ---
async function decodeRawImage(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const candidates = [];

  // Structured TIFF IFD parser
  if (bytes.length >= 8) {
    const magic = view.getUint16(0);
    const isLE = magic === 0x4949; // 'II'
    const isBE = magic === 0x4d4d; // 'MM'
    if (isLE || isBE) {
      const visited = new Set();
      function scanIFD(offset) {
        if (offset <= 0 || offset + 2 > bytes.length || visited.has(offset)) return;
        visited.add(offset);
        const count = view.getUint16(offset, isLE);
        let subIFDs = [];

        for (let i = 0; i < count; i++) {
          const entry = offset + 2 + i * 12;
          if (entry + 12 > bytes.length) break;
          const tag = view.getUint16(entry, isLE);
          const cnt = view.getUint32(entry + 4, isLE);
          const val = view.getUint32(entry + 8, isLE);

          if (tag === 0x0201) { // JPEGInterchangeFormat
            candidates.push({ offset: val, length: 0 });
          } else if (tag === 0x0111) { // StripOffsets
            if (cnt === 1) {
              candidates.push({ offset: val, length: 0 });
            } else if (cnt > 1 && val + cnt * 4 <= bytes.length) {
              for (let s = 0; s < Math.min(cnt, 24); s++) {
                candidates.push({ offset: view.getUint32(val + s * 4, isLE), length: 0 });
              }
            }
          } else if (tag === 0x014a) { // SubIFDs
            if (cnt === 1) subIFDs.push(val);
            else if (cnt > 1 && val + cnt * 4 <= bytes.length) {
              for (let s = 0; s < cnt; s++) subIFDs.push(view.getUint32(val + s * 4, isLE));
            }
          } else if (tag === 0x8769) { // ExifIFD
            subIFDs.push(val);
          }
        }
        subIFDs.forEach(scanIFD);
        const next = view.getUint32(offset + 2 + count * 12, isLE);
        if (next > 0 && next < bytes.length) scanIFD(next);
      }

      const first = view.getUint32(4, isLE);
      scanIFD(first);
    }
  }

  // Fujifilm RAF
  if (bytes.length >= 92) {
    const headerStr = String.fromCharCode(...bytes.subarray(0, 15));
    if (headerStr.startsWith("FUJIFILM")) {
      const jpgOffset = view.getUint32(84, false);
      const jpgLen = view.getUint32(88, false);
      if (jpgOffset > 0 && jpgLen > 0 && jpgOffset + jpgLen <= bytes.length) {
        candidates.push({ offset: jpgOffset, length: jpgLen });
      }
    }
  }

  // Strict JPEG marker sequence verifier
  function isValidJpeg(offset) {
    if (offset + 4 > bytes.length) return false;
    if (bytes[offset] !== 0xff || bytes[offset + 1] !== 0xd8) return false;

    let p = offset + 2;
    let foundSof = false;
    let foundSos = false;
    let steps = 0;

    while (p + 4 < bytes.length && steps < 60) {
      steps++;
      while (p < bytes.length && bytes[p] === 0xff) p++;
      if (p >= bytes.length) break;

      const marker = bytes[p++];
      if (marker === 0xd9) break;
      if (marker === 0xda) {
        foundSos = true;
        break;
      }

      if (p + 2 > bytes.length) break;
      const len = (bytes[p] << 8) | bytes[p + 1];
      if (len < 2 || p + len > bytes.length) break;

      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        if (len >= 7) {
          const h = (bytes[p + 3] << 8) | bytes[p + 4];
          const w = (bytes[p + 5] << 8) | bytes[p + 6];
          if (w >= 32 && h >= 32 && w <= 24000 && h <= 24000) {
            foundSof = true;
          }
        }
      }
      p += len;
    }
    return foundSof && foundSos;
  }

  const verified = [];
  for (const c of candidates) {
    if (c.offset > 0 && c.offset < bytes.length - 128) {
      if (isValidJpeg(c.offset)) verified.push(c.offset);
    }
  }

  // Stream scanner fallback for ISO/CR3 / DNG streams
  if (!verified.length) {
    for (let i = 0; i < bytes.length - 256; i++) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) {
        if (isValidJpeg(i)) {
          verified.push(i);
          i += 1000;
        }
      }
    }
  }

  if (!verified.length) {
    throw new Error("raw-codec-failed");
  }

  // Choose the candidate with largest resolution
  let best = null;
  let maxArea = 0;

  for (const off of verified) {
    const dims = extractJpegDimensions(bytes, off);
    const area = dims.width * dims.height;
    if (area > maxArea) {
      maxArea = area;
      best = { offset: off, width: dims.width, height: dims.height };
    }
  }

  if (!best) throw new Error("raw-codec-failed");

  // Find end of JPEG
  let end = best.offset + 2;
  while (end < bytes.length - 1) {
    if (bytes[end] === 0xff && bytes[end + 1] === 0xd9) {
      end += 2;
      break;
    }
    end++;
  }
  if (end <= best.offset + 4) end = bytes.length;

  const jpegSlice = bytes.subarray(best.offset, end);
  const jpegBlob = new Blob([jpegSlice], { type: "image/jpeg" });
  file._rawJpegBytes = jpegSlice;

  const decoded = await decodeBrowserImage(jpegBlob);
  return {
    source: decoded.source,
    width: decoded.width,
    height: decoded.height,
    previewBlob: jpegBlob
  };
}

function extractJpegDimensions(bytes, offset) {
  let p = offset + 2;
  while (p + 8 < bytes.length) {
    if (bytes[p] !== 0xff) { p++; continue; }
    const marker = bytes[p + 1];
    p += 2;
    if (marker === 0xd9 || marker === 0xda) break;
    if (p + 2 > bytes.length) break;
    const len = (bytes[p] << 8) | bytes[p + 1];
    if (len < 2 || p + len > bytes.length) break;
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      const height = (bytes[p + 3] << 8) | bytes[p + 4];
      const width = (bytes[p + 5] << 8) | bytes[p + 6];
      return { width, height };
    }
    p += len;
  }
  return { width: 0, height: 0 };
}

// --- Vector Graphics SVG Engine ---
async function decodeSvg(file) {
  const text = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "image/svg+xml");
  const svgEl = doc.querySelector("svg");
  if (!svgEl) throw new Error("svg-invalid");

  let w = parseFloat(svgEl.getAttribute("width") || "0");
  let h = parseFloat(svgEl.getAttribute("height") || "0");

  if (!w || !h) {
    const viewBox = svgEl.getAttribute("viewBox");
    if (viewBox) {
      const parts = viewBox.split(/[\s,]+/).map(parseFloat);
      if (parts.length >= 4) {
        w = parts[2];
        h = parts[3];
      }
    }
  }

  if (!w || !h) {
    w = 1200;
    h = 800;
  }

  // Dynamic supersampling scaler up to 2400px
  const maxDim = Math.max(w, h);
  let scale = 1;
  if (maxDim < 1800) {
    scale = Math.min(2400 / maxDim, 3);
  }
  const targetW = Math.round(w * scale);
  const targetH = Math.round(h * scale);

  svgEl.setAttribute("width", String(targetW));
  svgEl.setAttribute("height", String(targetH));

  const serialized = new XMLSerializer().serializeToString(svgEl);
  const svgBlob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("svg-render-failed"));
      img.src = url;
    });

    const canvas = Object.assign(document.createElement("canvas"), { width: targetW, height: targetH });
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas-unavailable");
    ctx.drawImage(image, 0, 0, targetW, targetH);

    const previewBlob = await new Promise((res) => canvas.toBlob(res, "image/png"));
    return { source: canvas, width: targetW, height: targetH, previewBlob };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// --- Adobe Photoshop PSD Engine ---
async function decodePsd(file) {
  await loadScript("ag-psd", CODECS.agPsd, () => window.agPsd);
  if (!window.agPsd._canvasInitDone) {
    window.agPsd.initializeCanvas((w, h) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      return c;
    });
    window.agPsd._canvasInitDone = true;
  }

  const buffer = await file.arrayBuffer();
  const psd = window.agPsd.readPsd(buffer, { skipLayerImageData: true, compositeOnly: true });
  if (!psd || !psd.canvas) throw new Error("psd-empty-composite");

  const canvas = psd.canvas;
  const width = canvas.width;
  const height = canvas.height;
  const previewBlob = await new Promise((res) => canvas.toBlob(res, "image/png"));
  return { source: canvas, width, height, previewBlob };
}

// --- Truevision TGA Engine ---
async function decodeTga(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 18) throw new Error("tga-invalid");

  const idLen = bytes[0];
  const imageType = bytes[2];
  const width = bytes[12] | (bytes[13] << 8);
  const height = bytes[14] | (bytes[15] << 8);
  const bpp = bytes[16];
  const descriptor = bytes[17];

  if (width <= 0 || height <= 0) throw new Error("tga-invalid-dimensions");
  const isRLE = imageType === 10 || imageType === 11;
  const isRGB = imageType === 2 || imageType === 10;
  const isGray = imageType === 3 || imageType === 11;

  if (!isRGB && !isGray) throw new Error("tga-unsupported-type");

  let pos = 18 + idLen;
  const canvas = Object.assign(document.createElement("canvas"), { width, height });
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unavailable");

  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;
  const totalPixels = width * height;
  let pixelIndex = 0;

  const bytesPerPixel = bpp >> 3;

  if (isRLE) {
    while (pixelIndex < totalPixels && pos < bytes.length) {
      const packet = bytes[pos++];
      const count = (packet & 0x7f) + 1;
      const isRunLength = (packet & 0x80) !== 0;

      if (isRunLength) {
        const b = bytes[pos++];
        const g = bytesPerPixel >= 2 ? bytes[pos++] : b;
        const r = bytesPerPixel >= 3 ? bytes[pos++] : b;
        const a = bytesPerPixel === 4 ? bytes[pos++] : 255;
        for (let i = 0; i < count; i++) {
          const idx = pixelIndex * 4;
          data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = a;
          pixelIndex++;
        }
      } else {
        for (let i = 0; i < count; i++) {
          const b = bytes[pos++];
          const g = bytesPerPixel >= 2 ? bytes[pos++] : b;
          const r = bytesPerPixel >= 3 ? bytes[pos++] : b;
          const a = bytesPerPixel === 4 ? bytes[pos++] : 255;
          const idx = pixelIndex * 4;
          data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = a;
          pixelIndex++;
        }
      }
    }
  } else {
    for (let i = 0; i < totalPixels; i++) {
      const b = bytes[pos++];
      const g = bytesPerPixel >= 2 ? bytes[pos++] : b;
      const r = bytesPerPixel >= 3 ? bytes[pos++] : b;
      const a = bytesPerPixel === 4 ? bytes[pos++] : 255;
      const idx = i * 4;
      data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = a;
    }
  }

  // Handle bottom-to-top orientation
  const isBottomUp = (descriptor & 0x20) === 0;
  if (isBottomUp) {
    const flipped = ctx.createImageData(width, height);
    const rowBytes = width * 4;
    for (let y = 0; y < height; y++) {
      const srcOffset = y * rowBytes;
      const dstOffset = (height - 1 - y) * rowBytes;
      flipped.data.set(data.subarray(srcOffset, srcOffset + rowBytes), dstOffset);
    }
    ctx.putImageData(flipped, 0, 0);
  } else {
    ctx.putImageData(imgData, 0, 0);
  }

  const previewBlob = await new Promise((res) => canvas.toBlob(res, "image/png"));
  return { source: canvas, width, height, previewBlob };
}

// --- NetPBM PPM/PGM/PBM Engine ---
async function decodeNetPbm(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes[0] !== 0x50) throw new Error("pbm-invalid-magic");
  const type = String.fromCharCode(bytes[1]);

  let pos = 2;
  function nextToken() {
    while (pos < bytes.length) {
      if (bytes[pos] <= 32) { pos++; continue; }
      if (bytes[pos] === 35) {
        while (pos < bytes.length && bytes[pos] !== 10 && bytes[pos] !== 13) pos++;
        continue;
      }
      break;
    }
    if (pos >= bytes.length) return null;
    let start = pos;
    while (pos < bytes.length && bytes[pos] > 32 && bytes[pos] !== 35) pos++;
    let token = "";
    for (let i = start; i < pos; i++) token += String.fromCharCode(bytes[i]);
    return token;
  }

  const width = parseInt(nextToken() || "0", 10);
  const height = parseInt(nextToken() || "0", 10);
  if (width <= 0 || height <= 0) throw new Error("pbm-invalid-dimensions");

  let maxVal = 1;
  if (type !== "1" && type !== "4") {
    maxVal = parseInt(nextToken() || "255", 10);
  }
  if (pos < bytes.length && bytes[pos] <= 32) pos++;

  const canvas = Object.assign(document.createElement("canvas"), { width, height });
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unavailable");
  const imgData = ctx.createImageData(width, height);
  const rgba = imgData.data;

  if (type === "6") { // Binary PPM
    const scale = 255 / maxVal;
    let src = pos;
    for (let i = 0; i < width * height; i++) {
      const dest = i * 4;
      rgba[dest] = Math.round(bytes[src++] * scale);
      rgba[dest + 1] = Math.round(bytes[src++] * scale);
      rgba[dest + 2] = Math.round(bytes[src++] * scale);
      rgba[dest + 3] = 255;
    }
  } else if (type === "5") { // Binary PGM
    const scale = 255 / maxVal;
    let src = pos;
    for (let i = 0; i < width * height; i++) {
      const dest = i * 4;
      const v = Math.round(bytes[src++] * scale);
      rgba[dest] = v; rgba[dest + 1] = v; rgba[dest + 2] = v; rgba[dest + 3] = 255;
    }
  } else {
    const scale = 255 / maxVal;
    for (let i = 0; i < width * height; i++) {
      const dest = i * 4;
      if (type === "3") {
        rgba[dest] = Math.round(parseInt(nextToken() || "0", 10) * scale);
        rgba[dest + 1] = Math.round(parseInt(nextToken() || "0", 10) * scale);
        rgba[dest + 2] = Math.round(parseInt(nextToken() || "0", 10) * scale);
      } else {
        const v = Math.round(parseInt(nextToken() || "0", 10) * scale);
        rgba[dest] = v; rgba[dest + 1] = v; rgba[dest + 2] = v;
      }
      rgba[dest + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const previewBlob = await new Promise((res) => canvas.toBlob(res, "image/png"));
  return { source: canvas, width, height, previewBlob };
}

// --- Apple HEIC/HEIF Engine ---
async function decodeHeic(file) {
  await loadScript("heic2any", CODECS.heic2any, () => window.heic2any);
  const conversionResult = await window.heic2any({
    blob: file,
    toType: "image/png",
    quality: 0.95
  });
  const pngBlob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
  return decodeBrowserImage(pngBlob);
}

// --- TIFF Engine ---
async function decodeTiff(file) {
  await loadScript("UTIF", CODECS.utif, () => window.UTIF);
  const buffer = await file.arrayBuffer();
  const ifds = window.UTIF.decode(buffer);
  if (!ifds.length) throw new Error("tiff-empty");
  window.UTIF.decodeImage(buffer, ifds[0]);
  const rgba = window.UTIF.toRGBA8(ifds[0]);
  const width = ifds[0].width;
  const height = ifds[0].height;
  const canvas = Object.assign(document.createElement("canvas"), { width, height });
  const context = canvas.getContext("2d", { alpha: true, colorSpace: "srgb" });
  if (!context) throw new Error("canvas-unavailable");
  const imageData = new ImageData(new Uint8ClampedArray(rgba), width, height);
  context.putImageData(imageData, 0, 0);
  const previewBlob = await new Promise((res) => canvas.toBlob(res, "image/png"));
  return { source: canvas, width, height, previewBlob };
}

// --- Standard Browser Image Decoder ---
async function decodeBrowserImage(fileOrBlob) {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(fileOrBlob, {
        premultiplyAlpha: "premultiply",
        colorSpaceConversion: "default"
      });
      return { source: bitmap, width: bitmap.width, height: bitmap.height };
    } catch (_) {}
  }

  const url = URL.createObjectURL(fileOrBlob);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("browser-image-decode-failed"));
      img.src = url;
    });

    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) throw new Error("browser-image-empty");
    return { source: image, width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// --- Dynamic Script Loader ---
function loadScript(name, src, test) {
  const existing = test();
  if (existing) return Promise.resolve(existing);
  if (scriptCache.has(src)) return scriptCache.get(src);

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      const loaded = test();
      loaded ? resolve(loaded) : reject(new Error(`${name}-unavailable`));
    };
    script.onerror = () => reject(new Error(`${name}-load-failed`));
    document.head.append(script);
  });

  scriptCache.set(src, promise);
  return promise;
}

// --- Canvas Drawing & Dimension Constraints ---
function drawToCanvas(source, origWidth, origHeight, resizeOpts = {}) {
  let targetWidth = origWidth;
  let targetHeight = origHeight;

  const maxWidth = Number(resizeOpts.maxWidth) || 0;
  const maxHeight = Number(resizeOpts.maxHeight) || 0;
  const maintainAspect = resizeOpts.maintainAspect !== false;

  if (maxWidth > 0 || maxHeight > 0) {
    if (maintainAspect) {
      const ratioW = maxWidth > 0 ? maxWidth / origWidth : 1;
      const ratioH = maxHeight > 0 ? maxHeight / origHeight : 1;
      const scale = Math.min(
        maxWidth > 0 ? ratioW : ratioH,
        maxHeight > 0 ? ratioH : ratioW,
        1
      );
      targetWidth = Math.max(1, Math.round(origWidth * scale));
      targetHeight = Math.max(1, Math.round(origHeight * scale));
    } else {
      if (maxWidth > 0) targetWidth = maxWidth;
      if (maxHeight > 0) targetHeight = maxHeight;
    }
  }

  const canvas =
    "OffscreenCanvas" in window
      ? new OffscreenCanvas(targetWidth, targetHeight)
      : Object.assign(document.createElement("canvas"), { width: targetWidth, height: targetHeight });

  const context = canvas.getContext("2d", {
    alpha: true,
    desynchronized: true,
    colorSpace: "srgb"
  });

  if (!context) throw new Error("canvas-unavailable");
  context.clearRect(0, 0, targetWidth, targetHeight);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, targetWidth, targetHeight);

  return { canvas, width: targetWidth, height: targetHeight };
}

// --- Multi-Format Canvas Encoders ---
async function canvasToFormat(canvas, format, quality) {
  switch (format) {
    case "png":
      return canvasToPng(canvas);
    case "jpeg":
    case "jpg":
      return canvasToJpeg(canvas, quality);
    case "avif":
      try {
        return await canvasToAvif(canvas, quality);
      } catch (_) {
        showToast("AVIF unsupported in this browser; converted to WebP.");
        return canvasToWebP(canvas, quality);
      }
    case "webp":
    default:
      return canvasToWebP(canvas, quality);
  }
}

function canvasToWebP(canvas, quality) {
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({ type: "image/webp", quality }).then(validateWebPBlob);
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("webp-unsupported"));
        else resolve(validateWebPBlob(blob));
      },
      "image/webp",
      quality
    );
  });
}

function canvasToPng(canvas) {
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({ type: "image/png" });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("png-unsupported"));
      else resolve(blob);
    }, "image/png");
  });
}

function canvasToJpeg(canvas, quality) {
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({ type: "image/jpeg", quality });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("jpeg-unsupported"));
      else resolve(blob);
    }, "image/jpeg", quality);
  });
}

function canvasToAvif(canvas, quality) {
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({ type: "image/avif", quality }).then((blob) => {
      if (!blob || blob.type !== "image/avif") throw new Error("avif-unsupported");
      return blob;
    });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== "image/avif") reject(new Error("avif-unsupported"));
      else resolve(blob);
    }, "image/avif", quality);
  });
}

function validateWebPBlob(blob) {
  if (!blob || blob.type !== "image/webp") {
    throw new Error("webp-unsupported");
  }
  return blob;
}

function disposeDecoded(source) {
  if (source && typeof source.close === "function") {
    source.close();
  }
}

// --- EXIF Metadata Injection & Optional GPS Stripping ---
async function tryPreserveExif(file, outputBlob, targetFormat, width, height, stripGps) {
  try {
    if (targetFormat !== "webp" && targetFormat !== "jpeg") return outputBlob;

    const exif = await extractJpegExif(file, stripGps);
    if (!exif) return outputBlob;

    if (targetFormat === "webp") {
      const webpBytes = new Uint8Array(await outputBlob.arrayBuffer());
      const withExif = injectExifIntoWebP(webpBytes, exif, width, height);
      return new Blob([withExif], { type: "image/webp" });
    }

    return outputBlob;
  } catch (_) {
    return outputBlob;
  }
}

async function extractJpegExif(file, stripGps = true) {
  const type = file.type.toLowerCase();
  const ext = getExtension(file.name);
  let bytes = null;

  if (file._rawJpegBytes) {
    bytes = file._rawJpegBytes;
  } else if (type.includes("jpeg") || ext === "jpg" || ext === "jpeg") {
    bytes = new Uint8Array(await file.arrayBuffer());
  } else {
    return null;
  }

  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];
    const size = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (marker === 0xe1) {
      const payload = bytes.slice(offset + 4, offset + 2 + size);
      const header = "Exif\0\0";
      const matchesHeader = header.split("").every((char, index) => payload[index] === char.charCodeAt(0));
      if (matchesHeader) {
        if (stripGps) {
          for (let i = 6; i < payload.length - 12; i++) {
            if ((payload[i] === 0x25 && payload[i + 1] === 0x88) || (payload[i] === 0x88 && payload[i + 1] === 0x25)) {
              payload[i] = 0; payload[i + 1] = 0;
            }
          }
        }
        return payload;
      }
      return null;
    }
    if (marker === 0xda || size < 2) break;
    offset += 2 + size;
  }

  return null;
}

function injectExifIntoWebP(webpBytes, exifBytes, width, height) {
  const signature = textFromBytes(webpBytes, 0, 4);
  const webpSignature = textFromBytes(webpBytes, 8, 4);
  if (signature !== "RIFF" || webpSignature !== "WEBP") return webpBytes;

  const chunks = [];
  let offset = 12;

  while (offset + 8 <= webpBytes.length) {
    const type = textFromBytes(webpBytes, offset, 4);
    const size = readUInt32LE(webpBytes, offset + 4);
    const start = offset + 8;
    const end = start + size;
    if (end > webpBytes.length) break;
    if (type !== "EXIF") {
      chunks.push({ type, data: webpBytes.slice(start, end) });
    }
    offset = end + (size % 2);
  }

  const hasVp8x = chunks.some((chunk) => chunk.type === "VP8X");
  const hasAlpha = chunks.some((chunk) => chunk.type === "ALPH");
  const hasIcc = chunks.some((chunk) => chunk.type === "ICCP");
  const hasXmp = chunks.some((chunk) => chunk.type === "XMP ");
  const hasAnimation = chunks.some((chunk) => chunk.type === "ANIM" || chunk.type === "ANMF");

  const normalized = chunks.map((chunk) => {
    if (chunk.type !== "VP8X") return chunk;
    const data = new Uint8Array(chunk.data);
    data[0] = data[0] | 0x08;
    return { type: chunk.type, data };
  });

  if (!hasVp8x) {
    const vp8x = new Uint8Array(10);
    vp8x[0] = 0x08;
    if (hasIcc) vp8x[0] |= 0x20;
    if (hasAlpha) vp8x[0] |= 0x10;
    if (hasXmp) vp8x[0] |= 0x04;
    if (hasAnimation) vp8x[0] |= 0x02;
    write24(vp8x, 4, Math.max(0, width - 1));
    write24(vp8x, 7, Math.max(0, height - 1));
    normalized.unshift({ type: "VP8X", data: vp8x });
  }

  normalized.push({ type: "EXIF", data: exifBytes });
  return buildWebP(normalized);
}

function buildWebP(chunks) {
  const parts = [bytesFromText("WEBP")];
  let size = 4;

  chunks.forEach((chunk) => {
    const header = new Uint8Array(8);
    header.set(bytesFromText(chunk.type), 0);
    writeUInt32LE(header, 4, chunk.data.length);
    parts.push(header, chunk.data);
    size += 8 + chunk.data.length;
    if (chunk.data.length % 2) {
      parts.push(new Uint8Array([0]));
      size += 1;
    }
  });

  const riff = new Uint8Array(8);
  riff.set(bytesFromText("RIFF"), 0);
  writeUInt32LE(riff, 4, size);
  return concatBytes([riff, ...parts]);
}

// --- UI Rendering ---
function render() {
  updateStats();
  renderQueue();
  renderPreview();
}

function updateStats() {
  const total = state.items.length;
  const done = state.items.filter((i) => i.status === "done");
  const failed = state.items.filter((i) => i.status === "error");
  const pending = state.items.filter((i) => i.status === "queued" || i.status === "converting");

  const origTotal = done.reduce((sum, i) => sum + i.originalSize, 0);
  const outTotal = done.reduce((sum, i) => sum + i.outputSize, 0);
  const savedTotal = Math.max(0, origTotal - outTotal);
  const overallSavedPercent = origTotal ? Math.round((savedTotal / origTotal) * 100) : 0;

  dom.totalFiles.textContent = String(total);
  dom.statQueuePending.textContent = `${pending.length} queued / waiting`;
  dom.completedFiles.textContent = String(done.length);
  dom.failedFiles.textContent = String(failed.length);
  dom.totalOriginalSize.textContent = formatBytes(origTotal);
  dom.totalOutput.textContent = formatBytes(outTotal);
  dom.totalSavedBytes.textContent = formatBytes(savedTotal);
  dom.totalSavedPercent.textContent = `${overallSavedPercent}%`;

  // Batch Progress Bar
  if (total > 0 && pending.length > 0) {
    dom.batchProgressWrapper.classList.remove("hidden");
    const completedCount = done.length + failed.length;
    const pct = Math.round((completedCount / total) * 100);
    dom.batchProgressPercent.textContent = `${pct}%`;
    dom.batchProgressBarFill.style.width = `${pct}%`;
    dom.batchProgressLabel.textContent = `Batch Conversion Progress (${completedCount} / ${total} files)`;
  } else {
    dom.batchProgressWrapper.classList.add("hidden");
  }

  // Queue Action Buttons
  dom.queueCountBadge.textContent = `${total} file${total === 1 ? "" : "s"}`;
  const hasSelected = state.items.some((i) => i.selectedForBatch);
  dom.removeSelectedBtn.disabled = !hasSelected;
  dom.pauseQueueBtn.disabled = total === 0;
  dom.retryFailedBtn.disabled = failed.length === 0;
  dom.clearQueueBtn.disabled = total === 0;
  dom.downloadZip.disabled = done.length < 2;
}

function renderQueue() {
  if (!state.items.length) {
    dom.queueList.innerHTML = `
      <div class="queue-empty-message">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
        <p>Your queue is empty. Drag photos or click above to begin batch conversion.</p>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();

  state.items.forEach((item) => {
    const row = document.createElement("article");
    const isActive = item.id === state.selectedId;
    const isDragging = item.id === state.draggedId;
    row.className = `queue-item${isActive ? " active" : ""}${isDragging ? " dragging" : ""}`;
    row.draggable = true;
    row.dataset.id = item.id;

    const ext = getExtension(item.name).toUpperCase() || "IMG";
    const formatClass = getFormatClass(item.name);
    const outName = formatOutputFilename(item.name, state.targetFormat, {
      namingPattern: dom.namingPattern.value,
      customPrefix: dom.customPrefixInput.value
    });

    row.innerHTML = `
      <div class="queue-item-header">
        <input type="checkbox" class="queue-checkbox" ${item.selectedForBatch ? "checked" : ""} aria-label="Select ${escapeHtml(item.name)}" />
        <div class="queue-thumb-wrap">
          <img class="queue-thumb" src="${item.outputUrl || item.previewUrl || item.originalUrl}" alt="" loading="lazy" />
        </div>
        <div class="queue-main">
          <div class="queue-title-row">
            <span class="format-badge format-${formatClass}">${escapeHtml(ext)}</span>
            <span class="queue-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
          </div>
          <div class="queue-submeta">
            <span>${formatBytes(item.originalSize)}</span>
            <span>•</span>
            <span>${item.width && item.height ? `${item.width}×${item.height}px` : "Original"}</span>
            <span>➔</span>
            <span class="text-blue font-semibold">${escapeHtml(outName)}</span>
          </div>
          <div class="progress-bar" style="--progress: ${item.progress}%"><span></span></div>
        </div>
        <div class="queue-item-actions">
          <button class="icon-btn" type="button" data-action="preview" title="Inspect / Compare" aria-label="Inspect ${escapeHtml(item.name)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
          </button>
          ${item.status === "error" ? `
          <button class="icon-btn text-orange" type="button" data-action="retry" title="Retry conversion" aria-label="Retry">
            <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
          </button>` : ""}
          <button class="icon-btn" type="button" data-action="download" title="Download converted file" aria-label="Download" ${item.status === "done" ? "" : "disabled"}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          </button>
          <button class="icon-btn text-red" type="button" data-action="remove" title="Remove from queue" aria-label="Remove">
            <svg viewBox="0 0 24 24" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>
      <div class="queue-item-footer">
        <div class="queue-status-col">
          <span class="status-pill status-${statusClass(item.status)}">${statusLabel(item.status)}</span>
        </div>
        <div class="queue-savings-col">
          ${item.status === "done"
            ? `<strong class="text-green">${item.savedPercent}% saved</strong> <small class="meta-sub">(${formatBytes(item.outputSize)})</small>`
            : item.status === "error"
            ? `<small class="text-red">${escapeHtml(item.error)}</small>`
            : `<small class="text-muted">Converting...</small>`
          }
        </div>
      </div>
    `;

    bindQueueRow(row);
    fragment.append(row);
  });

  dom.queueList.replaceChildren(fragment);
}

function renderQueueItem(id) {
  const row = dom.queueList.querySelector(`[data-id="${id}"]`);
  if (!row) return;
  const item = findItem(id);
  if (!item) return;

  const progressBar = row.querySelector(".progress-bar");
  if (progressBar) progressBar.style.setProperty("--progress", `${item.progress}%`);

  const statusCol = row.querySelector(".queue-status-col");
  if (statusCol) {
    statusCol.innerHTML = `<span class="status-pill status-${statusClass(item.status)}">${statusLabel(item.status)}</span>`;
  }

  const savingsCol = row.querySelector(".queue-savings-col");
  if (savingsCol) {
    savingsCol.innerHTML = item.status === "done"
      ? `<strong class="text-green">${item.savedPercent}% saved</strong> <small class="meta-sub">(${formatBytes(item.outputSize)})</small>`
      : item.status === "error"
      ? `<small class="text-red">${escapeHtml(item.error)}</small>`
      : `<small class="text-muted">Converting...</small>`;
  }

  const downloadBtn = row.querySelector('button[data-action="download"]');
  if (downloadBtn) {
    downloadBtn.disabled = item.status !== "done";
  }
}

function bindQueueRow(row) {
  row.addEventListener("click", (event) => {
    const id = row.dataset.id;
    if (!id) return;

    if (event.target.classList.contains("queue-checkbox")) {
      const item = findItem(id);
      if (item) {
        item.selectedForBatch = event.target.checked;
        updateStats();
      }
      return;
    }

    const button = event.target.closest("button");
    if (button) {
      const action = button.dataset.action;
      if (action === "download") {
        const item = findItem(id);
        if (item) downloadItem(item);
      }
      if (action === "remove") removeItem(id);
      if (action === "preview") {
        state.selectedId = id;
        renderPreview();
        renderQueue();
        openFullscreenInspector();
      }
      if (action === "retry") {
        const item = findItem(id);
        if (item) {
          item.status = "pending";
          item.error = null;
          item.progress = 0;
          renderQueue();
          startQueueWorker();
        }
      }
      return;
    }

    state.selectedId = id;
    renderPreview();
    renderQueue();
  });

  row.addEventListener("dragstart", (event) => {
    state.draggedId = row.dataset.id;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", state.draggedId);
    row.classList.add("dragging");
  });

  row.addEventListener("dragend", () => {
    state.draggedId = null;
    renderQueue();
  });

  row.addEventListener("dragover", (event) => {
    event.preventDefault();
    const targetId = row.dataset.id;
    const draggedId = state.draggedId;
    if (!draggedId || !targetId || draggedId === targetId) return;
    reorderItems(draggedId, targetId);
  });
}

function renderPreview() {
  const selected = findItem(state.selectedId) || state.items[0] || null;
  if (selected && selected.id !== state.selectedId) state.selectedId = selected.id;

  if (!selected) {
    dom.previewBadge.textContent = "Compare";
    dom.previewTitle.textContent = "No File Selected";
    dom.beforeImage.removeAttribute("src");
    dom.afterImage.removeAttribute("src");
    dom.sideBeforeImage.removeAttribute("src");
    dom.sideAfterImage.removeAttribute("src");
    dom.comparisonStage.classList.add("empty");
    dom.emptyState.classList.remove("hidden");
    dom.downloadSelected.disabled = true;
    dom.openFullscreenPreview.disabled = true;

    dom.selectedOriginal.textContent = "0 KB";
    dom.selectedOrigDim.textContent = "0 × 0";
    dom.selectedOutput.textContent = "0 KB";
    dom.selectedOutDim.textContent = "0 × 0";
    dom.selectedSaved.textContent = "0%";
    dom.selectedSavedBytes.textContent = "0 KB saved";
    return;
  }

  dom.emptyState.classList.add("hidden");
  dom.comparisonStage.classList.remove("empty");
  dom.previewTitle.textContent = selected.name;

  const ext = getExtension(selected.name).toUpperCase() || "IMG";
  dom.previewBadge.textContent = ext;
  dom.sideOriginalExt.textContent = ext;
  dom.sideAfterExt.textContent = state.targetFormat.toUpperCase();

  const originalSrc = selected.previewUrl || selected.originalUrl;
  dom.beforeImage.src = originalSrc;
  dom.sideBeforeImage.src = originalSrc;

  dom.selectedOriginal.textContent = formatBytes(selected.originalSize);
  dom.selectedOrigDim.textContent = selected.width && selected.height ? `${selected.width} × ${selected.height}` : "Pending";

  if (selected.status === "done" && selected.outputUrl) {
    dom.afterImage.src = selected.outputUrl;
    dom.sideAfterImage.src = selected.outputUrl;
    dom.downloadSelected.disabled = false;
    dom.openFullscreenPreview.disabled = false;

    dom.selectedOutput.textContent = formatBytes(selected.outputSize);
    dom.selectedOutDim.textContent = `${selected.width} × ${selected.height}`;
    dom.selectedSaved.textContent = `${selected.savedPercent}%`;
    dom.selectedSavedBytes.textContent = `${formatBytes(selected.savedBytes)} saved`;
  } else {
    dom.afterImage.removeAttribute("src");
    dom.sideAfterImage.removeAttribute("src");
    dom.downloadSelected.disabled = true;
    dom.openFullscreenPreview.disabled = !selected.previewUrl && !selected.originalUrl;

    dom.selectedOutput.textContent = selected.status === "error" ? "Failed" : "Converting...";
    dom.selectedOutDim.textContent = "—";
    dom.selectedSaved.textContent = "—";
    dom.selectedSavedBytes.textContent = selected.status === "error" ? selected.error : "In queue";
  }
}

// --- Format Catalog Rendering & Live Filtering ---
function renderFormatCatalog() {
  if (!dom.formatsGrid) return;
  const fragment = document.createDocumentFragment();

  FORMAT_CATALOG.forEach((item) => {
    const card = document.createElement("article");
    card.className = "format-card";
    card.dataset.cat = item.category;

    const badgeClass = getFormatClass(item.ext);
    card.innerHTML = `
      <div class="format-card-top">
        <span class="format-badge format-${badgeClass}">${escapeHtml(item.ext)}</span>
        <span class="spec-chip">${escapeHtml(item.engine)}</span>
      </div>
      <h3 class="format-card-name">${escapeHtml(item.name)}</h3>
      <p class="format-card-desc">${escapeHtml(item.desc)}</p>
      <div class="format-card-specs">
        <span class="spec-chip">100% Client-Side</span>
        <span class="spec-chip">Zero Upload</span>
      </div>
    `;
    fragment.append(card);
  });

  dom.formatsGrid.replaceChildren(fragment);
}

function filterFormatsCatalog() {
  const query = dom.formatSearchInput?.value.trim().toLowerCase() || "";
  const activeCat = state.activeFormatCat || "all";
  const cards = dom.formatsGrid?.querySelectorAll(".format-card") || [];

  cards.forEach((card) => {
    const text = card.textContent.toLowerCase();
    const cat = card.dataset.cat;
    const matchesQuery = !query || text.includes(query);
    const matchesCat = activeCat === "all" || cat === activeCat;
    card.style.display = matchesQuery && matchesCat ? "" : "none";
  });
}

// --- History Storage & Export ---
function addHistory(item) {
  const history = getHistory();
  history.unshift({
    id: item.id,
    name: item.name,
    originalSize: item.originalSize,
    outputSize: item.outputSize,
    savedBytes: item.savedBytes,
    savedPercent: item.savedPercent,
    targetFormat: state.targetFormat,
    date: new Date().toISOString()
  });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  renderHistory();
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch (_) {
    return [];
  }
}

function renderHistory() {
  if (!dom.historyList) return;
  const history = getHistory();
  const query = dom.historySearchInput?.value.trim().toLowerCase() || "";

  // Update Summary Metrics
  const totalCount = history.length;
  const origSum = history.reduce((sum, h) => sum + (h.originalSize || 0), 0);
  const outSum = history.reduce((sum, h) => sum + (h.outputSize || 0), 0);
  const savedSum = Math.max(0, origSum - outSum);

  if (dom.historyTotalCount) dom.historyTotalCount.textContent = String(totalCount);
  if (dom.historyOrigTotal) dom.historyOrigTotal.textContent = formatBytes(origSum);
  if (dom.historyOutTotal) dom.historyOutTotal.textContent = formatBytes(outSum);
  if (dom.historySavedTotal) dom.historySavedTotal.textContent = formatBytes(savedSum);

  const filtered = query
    ? history.filter((h) => h.name.toLowerCase().includes(query) || (h.targetFormat && h.targetFormat.toLowerCase().includes(query)))
    : history;

  if (!filtered.length) {
    dom.historyList.innerHTML = `
      <div class="history-empty">
        <p>${query ? "No conversions match your search." : "No conversion history recorded yet."}</p>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();
  filtered.forEach((entry, idx) => {
    const row = document.createElement("article");
    row.className = "history-row";
    row.dataset.index = String(idx);
    const date = new Date(entry.date);
    const timeFormatted = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const dateFormatted = date.toLocaleDateString([], { month: "short", day: "numeric" });
    const fmt = (entry.targetFormat || "webp").toUpperCase();

    row.innerHTML = `
      <div class="history-info">
        <div class="queue-title-row">
          <span class="format-badge format-web">${escapeHtml(fmt)}</span>
          <strong class="history-name" title="${escapeHtml(entry.name)}">${escapeHtml(entry.name)}</strong>
          <span class="status-pill status-done">Success</span>
        </div>
        <div class="history-meta">
          <span>${formatBytes(entry.originalSize)} ➔ ${formatBytes(entry.outputSize)}</span>
          <span>•</span>
          <span class="text-green font-semibold">${entry.savedPercent}% saved</span>
          <span>•</span>
          <span>${formatBytes(entry.savedBytes)} reduced</span>
        </div>
      </div>
      <div class="history-right">
        <span class="queue-submeta">${dateFormatted}, ${timeFormatted}</span>
        <button class="icon-btn text-red history-del-btn" type="button" data-action="delete-history" data-index="${idx}" title="Remove entry" aria-label="Remove entry">
          <svg viewBox="0 0 24 24" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    `;
    fragment.append(row);
  });

  dom.historyList.replaceChildren(fragment);
}

function exportHistoryToJson() {
  const history = getHistory();
  if (!history.length) {
    showToast("No history records to export.");
    return;
  }
  const jsonStr = JSON.stringify(history, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  downloadBlob(blob, `fluxwebp-conversion-history-${new Date().toISOString().slice(0, 10)}.json`);
  showToast("History exported as JSON.");
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
  showToast("Conversion history cleared.");
}

// --- Batch Queue Actions ---
function toggleSelectAllQueue() {
  const allSelected = state.items.length > 0 && state.items.every((i) => i.selectedForBatch);
  const next = !allSelected;
  state.items.forEach((i) => (i.selectedForBatch = next));
  dom.selectAllBtn.textContent = next ? "Deselect All" : "Select All";
  renderQueue();
  updateStats();
}

function removeSelectedQueueItems() {
  const selectedIds = new Set(state.items.filter((i) => i.selectedForBatch).map((i) => i.id));
  if (!selectedIds.size) return;

  state.items = state.items.filter((item) => {
    if (selectedIds.has(item.id)) {
      URL.revokeObjectURL(item.originalUrl);
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
      return false;
    }
    return true;
  });

  if (selectedIds.has(state.selectedId)) {
    state.selectedId = state.items[0]?.id || null;
  }

  render();
  showToast(`Removed ${selectedIds.size} item${selectedIds.size === 1 ? "" : "s"}.`);
}

function togglePauseQueue() {
  state.isPaused = !state.isPaused;
  const span = dom.pauseQueueBtn.querySelector("span");
  if (span) span.textContent = state.isPaused ? "Resume" : "Pause";
  showToast(state.isPaused ? "Queue paused." : "Queue resumed.");
  if (!state.isPaused) processQueue();
}

function retryFailedQueueItems() {
  const failed = state.items.filter((i) => i.status === "error");
  if (!failed.length) return;
  failed.forEach((i) => {
    i.status = "queued";
    i.progress = 0;
    i.error = "";
  });
  render();
  processQueue();
  showToast(`Retrying ${failed.length} failed item${failed.length === 1 ? "" : "s"}...`);
}

function clearQueue() {
  state.items.forEach((item) => {
    URL.revokeObjectURL(item.originalUrl);
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
  });
  state.items = [];
  state.selectedId = null;
  render();
  showToast("Queue cleared.");
}

function reorderItems(draggedId, targetId) {
  const from = state.items.findIndex((item) => item.id === draggedId);
  const to = state.items.findIndex((item) => item.id === targetId);
  if (from < 0 || to < 0 || from === to) return;
  const [moved] = state.items.splice(from, 1);
  state.items.splice(to, 0, moved);
  renderQueue();
}

function removeItem(id) {
  const index = state.items.findIndex((item) => item.id === id);
  if (index < 0) return;
  const [item] = state.items.splice(index, 1);
  URL.revokeObjectURL(item.originalUrl);
  if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
  if (state.selectedId === id) {
    state.selectedId = state.items[index]?.id || state.items[index - 1]?.id || null;
  }
  render();
}

function findItem(id) {
  return state.items.find((item) => item.id === id) || null;
}

// --- Download Handling & ZIP Generator ---
function downloadSelected() {
  const selected = findItem(state.selectedId);
  if (selected) downloadItem(selected);
}

function downloadItem(item) {
  if (!item.outputBlob) return;
  const filename = formatOutputFilename(item.name, state.targetFormat, {
    namingPattern: dom.namingPattern.value,
    customPrefix: dom.customPrefixInput.value
  });
  downloadBlob(item.outputBlob, filename);
}

async function downloadAllAsZip() {
  const done = state.items.filter((item) => item.status === "done" && item.outputBlob);
  if (done.length < 2) return;

  dom.downloadZip.disabled = true;
  const originalHtml = dom.downloadZip.innerHTML;
  dom.downloadZip.textContent = "Packaging ZIP...";

  try {
    const entries = await Promise.all(
      done.map(async (item, index) => {
        const filename = uniqueName(
          formatOutputFilename(item.name, state.targetFormat, {
            namingPattern: dom.namingPattern.value,
            customPrefix: dom.customPrefixInput.value
          }),
          index
        );
        return {
          name: filename,
          data: new Uint8Array(await item.outputBlob.arrayBuffer())
        };
      })
    );

    const zip = createZip(entries);
    downloadBlob(zip, `fluxwebp-optimized-${state.targetFormat}-batch.zip`);
    showToast(`ZIP package generated with ${done.length} files.`);
  } catch (err) {
    showToast("Failed to create ZIP package.");
  } finally {
    dom.downloadZip.innerHTML = originalHtml;
    updateStats();
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function formatOutputFilename(originalName, targetFormat, options = {}) {
  const pattern = options.namingPattern || "name_clean";
  const customPrefix = options.customPrefix ? options.customPrefix.trim() : "flux-";
  const cleanBase = sanitizeFilename(originalName).replace(/\.[^.]+$/, "") || "image";
  const ext = `.${targetFormat === "jpeg" ? "jpg" : targetFormat}`;

  switch (pattern) {
    case "name_optimized":
      return `${cleanBase}_optimized${ext}`;
    case "name_compressed":
      return `${cleanBase}_compressed${ext}`;
    case "custom_prefix":
      return `${customPrefix}${cleanBase}${ext}`;
    case "name_clean":
    default:
      return `${cleanBase}${ext}`;
  }
}

function sanitizeFilename(name) {
  return String(name || "image")
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

function uniqueName(name, index) {
  const dot = name.lastIndexOf(".");
  const base = dot > -1 ? name.slice(0, dot) : name;
  const ext = dot > -1 ? name.slice(dot) : `.${state.targetFormat}`;
  return `${base}-${String(index + 1).padStart(2, "0")}${ext}`;
}

// --- Sample Image Generator ---
async function loadSampleImage() {
  const canvas = document.createElement("canvas");
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");

  // Sky Gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 1080);
  grad.addColorStop(0, "#1e3a8a");
  grad.addColorStop(0.4, "#2563eb");
  grad.addColorStop(0.7, "#f97316");
  grad.addColorStop(1, "#facc15");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1920, 1080);

  // Glowing Sun
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.beginPath();
  ctx.arc(960, 480, 120, 0, Math.PI * 2);
  ctx.fill();

  // Mountain Silhouette 1
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.moveTo(0, 1080);
  ctx.lineTo(400, 520);
  ctx.lineTo(820, 780);
  ctx.lineTo(1240, 430);
  ctx.lineTo(1920, 1080);
  ctx.closePath();
  ctx.fill();

  // Mountain Silhouette 2 (Foreground)
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.moveTo(0, 1080);
  ctx.lineTo(320, 750);
  ctx.lineTo(650, 920);
  ctx.lineTo(1100, 680);
  ctx.lineTo(1600, 940);
  ctx.lineTo(1920, 1080);
  ctx.closePath();
  ctx.fill();

  // Grid texture to simulate photo detail
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  for (let i = 0; i < 40; i++) {
    ctx.fillRect(i * 50, 800 + (i % 5) * 12, 35, 120);
  }

  const blob = await new Promise((res) => canvas.toBlob(res, "image/png", 0.95));
  const file = new File([blob], "sample-sunset-mountains-1080p.png", { type: "image/png" });
  addFiles([file]);
  showToast("Loaded high-resolution sample image.");
}

// --- API Snippet Copy ---
function copyApiSnippet() {
  const code = dom.apiCodeBlock?.textContent || "";
  if (!code) return;
  navigator.clipboard.writeText(code).then(() => {
    showToast("JavaScript API code copied to clipboard!");
    const btnSpan = dom.copyApiCodeBtn.querySelector("span");
    if (btnSpan) {
      const orig = btnSpan.textContent;
      btnSpan.textContent = "Copied!";
      setTimeout(() => (btnSpan.textContent = orig), 2000);
    }
  });
}

// --- Pure Client-Side ZIP Generator ---
function createZip(entries) {
  const files = [];
  const central = [];
  let offset = 0;

  entries.forEach((entry) => {
    const nameBytes = encodeUtf8(entry.name);
    const data = entry.data;
    const crc = crc32(data);
    const localHeader = new Uint8Array(30);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, dosTime(), true);
    localView.setUint16(12, dosDate(), true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    files.push(localHeader, nameBytes, data);

    const centralHeader = new Uint8Array(46);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, dosTime(), true);
    centralView.setUint16(14, dosDate(), true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    central.push(centralHeader, nameBytes);

    offset += localHeader.length + nameBytes.length + data.length;
  });

  const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  return new Blob([...files, ...central, end], { type: "application/zip" });
}

function crc32(bytes) {
  let crc = -1;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let value = i;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

function dosTime(date = new Date()) {
  return (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
}

function dosDate(date = new Date()) {
  return ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
}

function bytesFromText(text) {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  return bytes;
}

function textFromBytes(bytes, offset, length) {
  let text = "";
  for (let i = offset; i < offset + length; i++) text += String.fromCharCode(bytes[i]);
  return text;
}

function encodeUtf8(text) {
  return new TextEncoder().encode(text);
}

function readUInt32LE(bytes, offset) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function writeUInt32LE(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

function write24(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
}

function concatBytes(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    out.set(chunk, offset);
    offset += chunk.length;
  });
  return out;
}

// --- Utilities & Formatters ---
function statusClass(status) {
  if (status === "done") return "completed";
  if (status === "converting") return "processing";
  if (status === "error") return "failed";
  return "waiting";
}

function statusLabel(status) {
  if (status === "queued") return "Waiting";
  if (status === "converting") return "Processing";
  if (status === "done") return "Ready";
  return "Failed";
}

function explainError(error, file) {
  const ext = getExtension(file.name).toUpperCase();
  if (error.message === "webp-unsupported") {
    return "This browser does not support WebP encoding.";
  }
  if (error.message === "raw-codec-failed" || RAW_EXTENSIONS.has(getExtension(file.name))) {
    return `${ext} Camera RAW: unable to parse camera-calibrated preview stream.`;
  }
  if (error.message === "psd-codec-failed" || ["PSD", "PSB"].includes(ext)) {
    return "Photoshop engine could not parse merged composite image.";
  }
  if (error.message === "svg-codec-failed" || ext === "SVG" || ext === "SVGZ") {
    return "Unable to parse or render SVG vector structure.";
  }
  if (error.message === "tga-codec-failed" || ["TGA", "TARGA"].includes(ext)) {
    return "Unable to decode Truevision TGA bitmap.";
  }
  if (error.message === "pbm-codec-failed" || ["PPM", "PGM", "PBM", "PNM"].includes(ext)) {
    return "Unable to decode NetPBM graphic file.";
  }
  if (error.message === "heic-codec-failed" || ["HEIC", "HEIF", "HIF"].includes(ext)) {
    return "HEIC/HEIF decoding failed or timed out.";
  }
  if (error.message === "tiff-codec-failed" || ["TIFF", "TIF"].includes(ext)) {
    return "TIFF decoding failed or unsupported compression.";
  }
  if (error.message === "canvas-unavailable") {
    return "Canvas 2D context unavailable.";
  }
  return "Unable to decode this image.";
}

function calculateSaved(original, output) {
  if (!original || !output) return 0;
  return Math.max(0, Math.round(((original - output) / original) * 100));
}

function formatBytes(bytes) {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function waitFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message) {
  const container = dom.toastContainer;
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  container.append(toast);

  window.setTimeout(() => {
    toast.style.transition = "opacity 300ms ease, transform 300ms ease";
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px) scale(0.96)";
    window.setTimeout(() => toast.remove(), 320);
  }, 3200);
}
