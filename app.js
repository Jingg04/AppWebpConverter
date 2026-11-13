const dom = {
  root: document.documentElement,
  themeToggle: document.querySelector(".theme-toggle"),
  fileInput: document.getElementById("fileInput"),
  dropzone: document.getElementById("dropzone"),
  qualityRange: document.getElementById("qualityRange"),
  qualityValue: document.getElementById("qualityValue"),
  qualityHelp: document.getElementById("qualityHelp"),
  autoOptimize: document.getElementById("autoOptimize"),
  preserveMetadata: document.getElementById("preserveMetadata"),
  totalFiles: document.getElementById("totalFiles"),
  totalSaved: document.getElementById("totalSaved"),
  totalOutput: document.getElementById("totalOutput"),
  comparison: document.getElementById("comparison"),
  beforeImage: document.getElementById("beforeImage"),
  afterImage: document.getElementById("afterImage"),
  afterLayer: document.getElementById("afterLayer"),
  compareHandle: document.getElementById("compareHandle"),
  compareRange: document.getElementById("compareRange"),
  previewTitle: document.getElementById("previewTitle"),
  selectedOriginal: document.getElementById("selectedOriginal"),
  selectedOutput: document.getElementById("selectedOutput"),
  selectedSaved: document.getElementById("selectedSaved"),
  downloadSelected: document.getElementById("downloadSelected"),
  downloadZip: document.getElementById("downloadZip"),
  queueList: document.getElementById("queueList"),
  historyList: document.getElementById("historyList"),
  clearHistory: document.getElementById("clearHistory"),
  loadSample: document.getElementById("loadSample"),
  toast: document.getElementById("toast")
};

const HISTORY_KEY = "fluxwebp-history";
const THEME_KEY = "fluxwebp-theme";

const RAW_EXTENSIONS = new Set([
  "arw", "srf", "sr2", // Sony
  "cr2", "cr3", "crw", // Canon
  "nef", "nrw",        // Nikon
  "dng",               // Adobe Digital Negative (universal)
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
  // NetPBM & simple formats
  "ppm", "pgm", "pbm", "pnm", "qoi",
  // All Camera RAW formats
  ...RAW_EXTENSIONS
]);

const MAX_HISTORY = 12;
const CODECS = {
  heic2any: "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js",
  utif: "https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.min.js",
  agPsd: "https://cdn.jsdelivr.net/npm/ag-psd@23.0.0/dist/bundle.js"
};

const state = {
  items: [],
  selectedId: null,
  quality: Number(dom.qualityRange.value),
  conversionVersion: 0,
  draggedId: null,
  toastTimer: null,
  warnedMetadata: false
};

const scriptCache = new Map();

initTheme();
bindEvents();
renderHistory();
syncCompare();

window.FluxWebP = {
  convertFile
};

function bindEvents() {
  dom.themeToggle.addEventListener("click", toggleTheme);
  dom.fileInput.addEventListener("change", (event) => addFiles(event.target.files));
  dom.loadSample.addEventListener("click", loadSampleImage);
  dom.autoOptimize.addEventListener("click", applyAutoOptimize);
  dom.preserveMetadata.addEventListener("change", handleMetadataToggle);
  dom.qualityRange.addEventListener("input", handleQualityChange);
  dom.compareRange.addEventListener("input", syncCompare);
  dom.downloadSelected.addEventListener("click", downloadSelected);
  dom.downloadZip.addEventListener("click", downloadAllAsZip);
  dom.clearHistory.addEventListener("click", clearHistory);

  ["dragenter", "dragover"].forEach((eventName) => {
    dom.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dom.dropzone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dom.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dom.dropzone.classList.remove("dragover");
    });
  });

  dom.dropzone.addEventListener("drop", (event) => {
    addFiles(event.dataTransfer.files);
  });
}

function initTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  dom.root.dataset.theme = stored || (prefersDark ? "dark" : "light");
}

function toggleTheme() {
  const next = dom.root.dataset.theme === "dark" ? "light" : "dark";
  dom.root.dataset.theme = next;
  localStorage.setItem(THEME_KEY, next);
}

function handleQualityChange() {
  state.quality = Number(dom.qualityRange.value);
  dom.qualityValue.value = state.quality;
  dom.qualityValue.textContent = state.quality;
  dom.qualityHelp.textContent = qualityLabel(state.quality);
  scheduleReconvert();
}

function qualityLabel(value) {
  if (value >= 90) return "Maximum detail with lighter compression.";
  if (value >= 70) return "Balanced for crisp visuals and smaller files.";
  if (value >= 40) return "Strong compression for performance-focused assets.";
  return "Tiny output with visible quality tradeoffs.";
}

function handleMetadataToggle() {
  if (dom.preserveMetadata.checked && !state.warnedMetadata) {
    state.warnedMetadata = true;
    showToast("EXIF preservation is best-effort for JPEG inputs; canvas conversion can strip unsupported metadata.");
  }
  scheduleReconvert();
}

function applyAutoOptimize() {
  const hasLargeFile = state.items.some((item) => item.file.size > 3_000_000);
  const hasTransparent = state.items.some((item) => /png/i.test(item.file.type) || /\.png$/i.test(item.name));
  const nextQuality = hasLargeFile ? 76 : hasTransparent ? 88 : 82;
  dom.qualityRange.value = String(nextQuality);
  handleQualityChange();
  showToast(`Auto optimize set quality to ${nextQuality}.`);
}

function addFiles(fileList) {
  const incoming = Array.from(fileList || []);
  const imageFiles = incoming.filter(isAcceptedImage);
  const rejected = incoming.length - imageFiles.length;

  if (rejected) {
    showToast(`${rejected} unsupported file${rejected === 1 ? "" : "s"} skipped.`);
  }

  if (!imageFiles.length) return;

  const items = imageFiles.map((file) => {
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
      status: "queued",
      progress: 0,
      error: "",
      width: 0,
      height: 0
    };
  });

  state.items.push(...items);
  if (!state.selectedId) state.selectedId = items[0].id;
  render();
  convertAll();
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
  if (["psd", "psb"].includes(ext)) return "psd";
  if (["heic", "heif", "hif"].includes(ext)) return "heic";
  if (["tif", "tiff"].includes(ext)) return "tiff";
  if (["svg", "svgz"].includes(ext)) return "svg";
  if (["avif"].includes(ext)) return "avif";
  if (["webp"].includes(ext)) return "webp";
  if (["png"].includes(ext)) return "png";
  if (["jpg", "jpeg"].includes(ext)) return "jpg";
  return "misc";
}

function scheduleReconvert() {
  window.clearTimeout(scheduleReconvert.timer);
  scheduleReconvert.timer = window.setTimeout(() => {
    state.items.forEach((item) => {
      if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
      item.outputBlob = null;
      item.outputUrl = "";
      item.outputSize = 0;
      item.savedPercent = 0;
      item.status = "queued";
      item.progress = 0;
      item.error = "";
    });
    render();
    convertAll();
  }, 220);
}

async function convertAll() {
  if (!state.items.length) return;

  const version = ++state.conversionVersion;
  const queue = [...state.items];
  const concurrency = Math.min(3, queue.length);
  let cursor = 0;

  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < queue.length) {
      const item = queue[cursor];
      cursor += 1;
      await convertItem(item, version);
    }
  });

  await Promise.allSettled(workers);
  if (version === state.conversionVersion) {
    render();
  }
}

async function convertItem(item, version) {
  item.status = "converting";
  item.progress = 12;
  item.error = "";
  render();

  try {
    await waitFrame();
    item.progress = 34;
    render();

    const result = await convertFile(item.file, {
      quality: state.quality,
      preserveMetadata: dom.preserveMetadata.checked
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
    item.status = "done";
    item.progress = 100;
    addHistory(item);
  } catch (error) {
    if (version !== state.conversionVersion) return;
    item.status = "error";
    item.progress = 100;
    item.error = explainError(error, item.file);
  }

  render();
}

async function convertFile(file, options = {}) {
  const quality = clamp(Number(options.quality ?? 82), 0, 100) / 100;
  const decoded = await decodeImage(file);
  const canvas = drawToCanvas(decoded.source, decoded.width, decoded.height);
  const blob = await canvasToWebP(canvas, quality);
  const finalBlob = options.preserveMetadata
    ? await tryPreserveExif(file, blob, decoded.width, decoded.height)
    : blob;

  disposeDecoded(decoded.source);

  return {
    blob: finalBlob,
    previewBlob: decoded.previewBlob || null,
    width: decoded.width,
    height: decoded.height,
    originalSize: file.size,
    outputSize: finalBlob.size,
    savedPercent: calculateSaved(file.size, finalBlob.size)
  };
}

async function decodeImage(file) {
  const ext = getExtension(file.name);

  // 1. Camera RAW formats (Sony ARW, Canon CR2/CR3, Nikon NEF, Adobe DNG, Fuji RAF, Olympus ORF, Panasonic RW2, Pentax PEF, etc.)
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

  // 2. Vector Graphics (SVG)
  if (ext === "svg" || ext === "svgz" || /svg/i.test(file.type)) {
    try {
      return await decodeSvg(file);
    } catch (svgError) {
      throw new Error("svg-codec-failed", { cause: svgError });
    }
  }

  // 3. Adobe Photoshop (PSD, PSB)
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

  // 6. High Efficiency Image Container (HEIC, HEIF, HIF)
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

  // 7. Tagged Image File Format (TIFF, TIF)
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

  // 8. Standard Browser-native (JPG, PNG, GIF, BMP, WEBP, AVIF, ICO, CUR)
  return decodeBrowserImage(file);
}

async function decodeRawImage(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const candidates = [];

  // 1. TIFF structured parser (ARW, CR2, NEF, DNG, PEF, ORF, RW2, etc.)
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

  // 2. Fujifilm RAF
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

  // 3. Canon CR3 (ISOBMFF container with 'ftypcrx ')
  if (bytes.length >= 32) {
    const ftyp = String.fromCharCode(...bytes.subarray(4, 12));
    if (ftyp === "ftypcrx " || ftyp.includes("crx")) {
      let boxOffset = 0;
      while (boxOffset + 8 <= bytes.length) {
        const boxSize = view.getUint32(boxOffset, false);
        const boxType = String.fromCharCode(...bytes.subarray(boxOffset + 4, boxOffset + 8));
        if (boxSize < 8) break;
        if (boxType === "uuid" || boxType === "prvw" || boxType === "moov") {
          for (let k = boxOffset + 8; k < Math.min(boxOffset + boxSize, bytes.length - 4); k++) {
            if (bytes[k] === 0xff && bytes[k + 1] === 0xd8 && bytes[k + 2] === 0xff) {
              candidates.push({ offset: k, length: 0 });
              break;
            }
          }
        }
        boxOffset += boxSize;
      }
    }
  }

  // Evaluate candidate offsets with strict JPEG validator
  const valid = [];
  candidates.forEach((c) => {
    if (c.offset < 0 || c.offset >= bytes.length - 4) return;
    if (bytes[c.offset] === 0xff && bytes[c.offset + 1] === 0xd8) {
      let end = c.length > 0 && c.offset + c.length <= bytes.length ? c.offset + c.length : -1;
      if (end <= 0 || bytes[end - 2] !== 0xff || bytes[end - 1] !== 0xd9) {
        for (let j = c.offset + 10; j < Math.min(c.offset + 25_000_000, bytes.length - 1); j++) {
          if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) {
            end = j + 2;
            break;
          }
        }
      }
      if (end > c.offset) {
        const info = isValidJpeg(bytes, c.offset, end);
        if (info) valid.push(info);
      }
    }
  });

  // If no high-res preview found (> 64KB), run fast scanner across the stream
  const hasLarge = valid.some((v) => v.length > 65536);
  if (!hasLarge) {
    for (let i = 0; i < bytes.length - 4; i++) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xd8) {
        for (let j = i + 100; j < Math.min(i + 25_000_000, bytes.length - 1); j++) {
          if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) {
            const info = isValidJpeg(bytes, i, j + 2);
            if (info && info.length > 32768) {
              valid.push(info);
            }
            break;
          }
        }
      }
    }
  }

  if (valid.length > 0) {
    valid.sort((a, b) => (b.pixels - a.pixels) || (b.length - a.length));
    const best = valid[0];
    const slice = bytes.subarray(best.offset, best.offset + best.length);
    file._rawJpegBytes = slice; // Cache for EXIF preservation
    const jpegBlob = new Blob([slice], { type: "image/jpeg" });
    const decoded = await decodeBrowserImage(jpegBlob);
    return {
      source: decoded.source,
      width: decoded.width,
      height: decoded.height,
      previewBlob: jpegBlob
    };
  }

  // Fallback if no embedded JPEG found (e.g. uncompressed linear DNG or TIFF RAW)
  return decodeTiff(file);
}

function isValidJpeg(bytes, start, end) {
  if (start < 0 || end > bytes.length || end - start < 100) return null;
  if (bytes[start] !== 0xff || bytes[start + 1] !== 0xd8) return null;

  const m2 = bytes[start + 2], m3 = bytes[start + 3];
  if (m2 !== 0xff) return null;
  if (![0xe0, 0xe1, 0xe2, 0xdb, 0xc4, 0xc0, 0xc2, 0xfe, 0xee].includes(m3)) return null;

  let offset = start + 2;
  let width = 0, height = 0, foundSos = false;

  while (offset < end - 1) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    if (marker === 0xd9) break; // EOI
    if (marker === 0xda) {
      foundSos = true;
      break;
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
    if (offset + 4 > end) return null;
    const len = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (len < 2 || offset + 2 + len > end) return null;

    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      width = (bytes[offset + 7] << 8) | bytes[offset + 8];
    }
    offset += 2 + len;
  }

  if (!foundSos || width <= 0 || height <= 0 || width > 35000 || height > 35000) return null;
  return { offset: start, length: end - start, width, height, pixels: width * height };
}

async function decodeSvg(file) {
  const text = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) throw new Error("svg-invalid");

  let width = parseFloat(svg.getAttribute("width") || "");
  let height = parseFloat(svg.getAttribute("height") || "");

  if ((!width || !height || isNaN(width) || isNaN(height)) && svg.hasAttribute("viewBox")) {
    const parts = svg.getAttribute("viewBox").trim().split(/[\s,]+/);
    if (parts.length >= 4) {
      const vbWidth = parseFloat(parts[2]);
      const vbHeight = parseFloat(parts[3]);
      if (vbWidth > 0 && vbHeight > 0) {
        width = vbWidth;
        height = vbHeight;
      }
    }
  }

  if (!width || isNaN(width)) width = 1200;
  if (!height || isNaN(height)) height = 800;

  const maxDim = Math.max(width, height);
  const scale = Math.max(1, Math.min(4, Math.round(2400 / maxDim)));
  const renderWidth = Math.round(width * scale);
  const renderHeight = Math.round(height * scale);

  svg.setAttribute("width", String(renderWidth));
  svg.setAttribute("height", String(renderHeight));

  const serialized = new XMLSerializer().serializeToString(doc);
  const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    const image = new Image();
    image.decoding = "async";
    image.loading = "eager";
    image.src = url;
    await image.decode();

    const canvas = Object.assign(document.createElement("canvas"), {
      width: renderWidth,
      height: renderHeight
    });
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas-unavailable");
    ctx.drawImage(image, 0, 0, renderWidth, renderHeight);

    const previewBlob = await new Promise((res) => canvas.toBlob(res, "image/png"));
    return {
      source: canvas,
      width: renderWidth,
      height: renderHeight,
      previewBlob
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function decodePsd(file) {
  await loadScript("agPsd", CODECS.agPsd, () => window.agPsd);
  if (!window.agPsd._initialized) {
    window.agPsd.initializeCanvas(
      (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h })
    );
    window.agPsd._initialized = true;
  }

  const buffer = await file.arrayBuffer();
  const psd = window.agPsd.readPsd(buffer, { skipLayerImageData: true });
  const width = psd.width;
  const height = psd.height;

  if (psd.canvas) {
    const previewBlob = await new Promise((res) => psd.canvas.toBlob(res, "image/png"));
    return { source: psd.canvas, width, height, previewBlob };
  }

  const canvas = Object.assign(document.createElement("canvas"), { width, height });
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unavailable");

  if (psd.image) {
    const imgData = ctx.createImageData(width, height);
    imgData.data.set(psd.image);
    ctx.putImageData(imgData, 0, 0);
  }

  const previewBlob = await new Promise((res) => canvas.toBlob(res, "image/png"));
  return { source: canvas, width, height, previewBlob };
}

async function decodeTga(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 18) throw new Error("tga-invalid-header");

  const idLen = bytes[0];
  const colorMapType = bytes[1];
  const imageType = bytes[2];
  const width = bytes[12] | (bytes[13] << 8);
  const height = bytes[14] | (bytes[15] << 8);
  const bpp = bytes[16];
  const descriptor = bytes[17];
  const topDown = (descriptor & 0x20) !== 0;

  if (width <= 0 || height <= 0) throw new Error("tga-invalid-dimensions");
  if (bpp !== 24 && bpp !== 32 && bpp !== 8) throw new Error("tga-unsupported-depth");

  let offset = 18 + idLen;
  if (colorMapType === 1) {
    const mapLen = (bytes[5] | (bytes[6] << 8)) * Math.ceil(bytes[7] / 8);
    offset += mapLen;
  }

  const canvas = Object.assign(document.createElement("canvas"), { width, height });
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unavailable");

  const imgData = ctx.createImageData(width, height);
  const rgba = imgData.data;
  const bytesPerPixel = bpp / 8;
  const totalPixels = width * height;

  if (imageType === 2 || imageType === 3) {
    for (let i = 0; i < totalPixels; i++) {
      const p = offset + i * bytesPerPixel;
      const b = bytes[p];
      const g = bytesPerPixel >= 3 ? bytes[p + 1] : b;
      const r = bytesPerPixel >= 3 ? bytes[p + 2] : b;
      const a = bytesPerPixel === 4 ? bytes[p + 3] : 255;
      const row = topDown ? Math.floor(i / width) : height - 1 - Math.floor(i / width);
      const col = i % width;
      const dest = (row * width + col) * 4;
      rgba[dest] = r; rgba[dest + 1] = g; rgba[dest + 2] = b; rgba[dest + 3] = a;
    }
  } else if (imageType === 10 || imageType === 11) {
    let pixelCount = 0;
    while (pixelCount < totalPixels && offset < bytes.length) {
      const header = bytes[offset++];
      const count = (header & 0x7f) + 1;
      const isRle = (header & 0x80) !== 0;
      if (isRle) {
        const b = bytes[offset];
        const g = bytesPerPixel >= 3 ? bytes[offset + 1] : b;
        const r = bytesPerPixel >= 3 ? bytes[offset + 2] : b;
        const a = bytesPerPixel === 4 ? bytes[offset + 3] : 255;
        offset += bytesPerPixel;
        for (let k = 0; k < count; k++) {
          const idx = pixelCount + k;
          const row = topDown ? Math.floor(idx / width) : height - 1 - Math.floor(idx / width);
          const col = idx % width;
          const dest = (row * width + col) * 4;
          rgba[dest] = r; rgba[dest + 1] = g; rgba[dest + 2] = b; rgba[dest + 3] = a;
        }
      } else {
        for (let k = 0; k < count; k++) {
          const p = offset + k * bytesPerPixel;
          const b = bytes[p];
          const g = bytesPerPixel >= 3 ? bytes[p + 1] : b;
          const r = bytesPerPixel >= 3 ? bytes[p + 2] : b;
          const a = bytesPerPixel === 4 ? bytes[p + 3] : 255;
          const idx = pixelCount + k;
          const row = topDown ? Math.floor(idx / width) : height - 1 - Math.floor(idx / width);
          const col = idx % width;
          const dest = (row * width + col) * 4;
          rgba[dest] = r; rgba[dest + 1] = g; rgba[dest + 2] = b; rgba[dest + 3] = a;
        }
        offset += count * bytesPerPixel;
      }
      pixelCount += count;
    }
  } else {
    throw new Error("tga-unsupported-type");
  }

  ctx.putImageData(imgData, 0, 0);
  const previewBlob = await new Promise((res) => canvas.toBlob(res, "image/png"));
  return { source: canvas, width, height, previewBlob };
}

async function decodeNetPbm(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes[0] !== 0x50) throw new Error("pbm-invalid-magic");
  const type = String.fromCharCode(bytes[1]);

  let pos = 2;
  function nextToken() {
    while (pos < bytes.length) {
      if (bytes[pos] <= 32) { pos++; continue; }
      if (bytes[pos] === 35) { // '#'
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

function drawToCanvas(source, width, height) {
  const canvas =
    "OffscreenCanvas" in window
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement("canvas"), { width, height });
  const context = canvas.getContext("2d", {
    alpha: true,
    desynchronized: true,
    colorSpace: "srgb"
  });

  if (!context) throw new Error("canvas-unavailable");
  context.clearRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);
  return canvas;
}

function canvasToWebP(canvas, quality) {
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({ type: "image/webp", quality }).then(validateWebPBlob);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("webp-unsupported"));
          return;
        }
        try {
          resolve(validateWebPBlob(blob));
        } catch (error) {
          reject(error);
        }
      },
      "image/webp",
      quality
    );
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

async function tryPreserveExif(file, webpBlob, width, height) {
  try {
    const exif = await extractJpegExif(file);
    if (!exif) return webpBlob;
    const webpBytes = new Uint8Array(await webpBlob.arrayBuffer());
    const withExif = injectExifIntoWebP(webpBytes, exif, width, height);
    return new Blob([withExif], { type: "image/webp" });
  } catch (_) {
    return webpBlob;
  }
}

async function extractJpegExif(file) {
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
      return matchesHeader ? payload : null;
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

function render() {
  renderSummary();
  renderQueue();
  renderPreview();
}

function renderSummary() {
  const done = state.items.filter((item) => item.status === "done");
  const originalTotal = done.reduce((sum, item) => sum + item.originalSize, 0);
  const outputTotal = done.reduce((sum, item) => sum + item.outputSize, 0);

  dom.totalFiles.textContent = String(state.items.length);
  dom.totalOutput.textContent = formatBytes(outputTotal);
  dom.totalSaved.textContent = originalTotal ? `${calculateSaved(originalTotal, outputTotal)}%` : "0%";
  dom.downloadZip.disabled = done.length < 2;
}

function renderQueue() {
  const fragment = document.createDocumentFragment();

  state.items.forEach((item) => {
    const row = document.createElement("article");
    row.className = `queue-item${item.id === state.selectedId ? " active" : ""}${item.id === state.draggedId ? " dragging" : ""}`;
    row.draggable = true;
    row.dataset.id = item.id;

    const thumb = document.createElement("img");
    thumb.className = "queue-thumb";
    thumb.src = item.outputUrl || item.previewUrl || item.originalUrl;
    thumb.alt = "";
    thumb.loading = "lazy";

    const formatClass = getFormatClass(item.name);
    const formatName = getExtension(item.name).toUpperCase() || "IMG";

    const main = document.createElement("div");
    main.className = "queue-main";
    main.innerHTML = `
      <div class="queue-title">
        <span class="format-badge format-${formatClass}">${escapeHtml(formatName)}</span>
        <strong title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</strong>
        <span class="status-pill ${statusClass(item.status)}">${statusLabel(item.status)}</span>
      </div>
      <div class="queue-meta">
        <span>${formatBytes(item.originalSize)} original</span>
        <span>${item.outputSize ? `${formatBytes(item.outputSize)} WebP` : "Waiting for WebP"}</span>
        <span>${item.status === "error" ? escapeHtml(item.error) : `${item.savedPercent}% saved`}</span>
      </div>
      <div class="progress-bar" style="--progress: ${item.progress}%"><span></span></div>
    `;

    const actions = document.createElement("div");
    actions.className = "queue-actions";
    actions.innerHTML = `
      <button class="icon-button" type="button" data-action="download" aria-label="Download ${escapeHtml(item.name)}" ${item.status === "done" ? "" : "disabled"}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="M7 10l5 5 5-5"></path><path d="M12 15V3"></path></svg>
      </button>
      <button class="icon-button" type="button" data-action="remove" aria-label="Remove ${escapeHtml(item.name)}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6L6 18"></path><path d="M6 6l12 12"></path></svg>
      </button>
    `;

    row.append(thumb, main, actions);
    bindQueueRow(row);
    fragment.append(row);
  });

  dom.queueList.replaceChildren(fragment);
}

function bindQueueRow(row) {
  row.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    const id = row.dataset.id;
    if (!id) return;

    if (button) {
      const action = button.dataset.action;
      if (action === "download") {
        const item = findItem(id);
        if (item) downloadItem(item);
      }
      if (action === "remove") removeItem(id);
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
    dom.previewTitle.textContent = "No file selected";
    dom.beforeImage.removeAttribute("src");
    dom.afterImage.removeAttribute("src");
    dom.comparison.classList.add("empty");
    dom.downloadSelected.disabled = true;
    dom.selectedOriginal.textContent = "Original: 0 KB";
    dom.selectedOutput.textContent = "WebP: 0 KB";
    dom.selectedSaved.textContent = "Saved: 0%";
    return;
  }

  dom.previewTitle.textContent = selected.name;
  dom.beforeImage.src = selected.previewUrl || selected.originalUrl;
  dom.selectedOriginal.textContent = `Original: ${formatBytes(selected.originalSize)}`;

  if (selected.status === "done" && selected.outputUrl) {
    dom.afterImage.src = selected.outputUrl;
    dom.comparison.classList.remove("empty");
    dom.downloadSelected.disabled = false;
    dom.selectedOutput.textContent = `WebP: ${formatBytes(selected.outputSize)}`;
    dom.selectedSaved.textContent = `Saved: ${selected.savedPercent}%`;
  } else {
    dom.afterImage.removeAttribute("src");
    dom.comparison.classList.add("empty");
    dom.downloadSelected.disabled = true;
    dom.selectedOutput.textContent = selected.status === "error" ? "WebP: failed" : "WebP: converting...";
    dom.selectedSaved.textContent = selected.status === "error" ? selected.error : "Saved: pending";
  }
}

function renderHistory() {
  const history = getHistory();
  const fragment = document.createDocumentFragment();

  history.forEach((entry) => {
    const row = document.createElement("article");
    const date = new Date(entry.date);
    row.innerHTML = `
      <div>
        <strong title="${escapeHtml(entry.name)}">${escapeHtml(entry.name)}</strong>
        <span>${formatBytes(entry.originalSize)} to ${formatBytes(entry.outputSize)} - ${entry.savedPercent}% saved</span>
      </div>
      <span>${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
    `;
    fragment.append(row);
  });

  dom.historyList.replaceChildren(fragment);
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

function statusClass(status) {
  if (status === "done") return "done";
  if (status === "error") return "error";
  return "";
}

function statusLabel(status) {
  if (status === "queued") return "Queued";
  if (status === "converting") return "Converting";
  if (status === "done") return "Ready";
  return "Needs attention";
}

function syncCompare() {
  const value = Number(dom.compareRange.value);
  const fraction = Math.max(0.01, Math.min(1, value / 100));
  dom.afterLayer.style.width = `${value}%`;
  dom.afterLayer.style.setProperty("--compare-width", String(fraction));
  dom.compareHandle.style.left = `${value}%`;
}

function downloadSelected() {
  const selected = findItem(state.selectedId);
  if (selected) downloadItem(selected);
}

function downloadItem(item) {
  if (!item.outputBlob) return;
  downloadBlob(item.outputBlob, toWebPName(item.name));
}

async function downloadAllAsZip() {
  const done = state.items.filter((item) => item.status === "done" && item.outputBlob);
  if (done.length < 2) return;

  dom.downloadZip.disabled = true;
  dom.downloadZip.textContent = "Preparing ZIP";

  try {
    const entries = await Promise.all(
      done.map(async (item, index) => ({
        name: uniqueName(toWebPName(item.name), index),
        data: new Uint8Array(await item.outputBlob.arrayBuffer())
      }))
    );
    const zip = createZip(entries);
    downloadBlob(zip, "fluxwebp-conversions.zip");
    showToast(`ZIP ready with ${done.length} files.`);
  } finally {
    dom.downloadZip.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="M7 10l5 5 5-5"></path><path d="M12 15V3"></path></svg>
      Download ZIP
    `;
    renderSummary();
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
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function uniqueName(name, index) {
  const dot = name.lastIndexOf(".");
  const base = dot > -1 ? name.slice(0, dot) : name;
  const ext = dot > -1 ? name.slice(dot) : ".webp";
  return `${base || "image"}-${String(index + 1).padStart(2, "0")}${ext}`;
}

function toWebPName(name) {
  const safe = sanitizeFilename(name).replace(/\.[^.]+$/, "");
  return `${safe || "converted"}.webp`;
}

function sanitizeFilename(name) {
  return String(name || "image")
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

function addHistory(item) {
  const history = getHistory();
  history.unshift({
    name: item.name,
    originalSize: item.originalSize,
    outputSize: item.outputSize,
    savedPercent: item.savedPercent,
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

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
  showToast("Conversion history cleared.");
}

async function loadSampleImage() {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 1000;
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#0a84ff");
  gradient.addColorStop(0.48, "#19c37d");
  gradient.addColorStop(1, "#ff6b5f");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(255,255,255,.86)";
  context.beginPath();
  context.arc(360, 260, 96, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgba(255,255,255,.72)";
  context.beginPath();
  context.moveTo(0, 1000);
  context.lineTo(420, 420);
  context.lineTo(680, 720);
  context.lineTo(980, 310);
  context.lineTo(1600, 1000);
  context.closePath();
  context.fill();
  context.fillStyle = "rgba(17,24,39,.16)";
  for (let i = 0; i < 14; i += 1) {
    context.fillRect(120 + i * 98, 850 - i * 18, 62, 18);
  }

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.96));
  const file = new File([blob], "sample-gradient-landscape.png", { type: "image/png" });
  addFiles([file]);
}

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
  for (let i = 0; i < bytes.length; i += 1) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
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
  for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i);
  return bytes;
}

function textFromBytes(bytes, offset, length) {
  let text = "";
  for (let i = offset; i < offset + length; i += 1) text += String.fromCharCode(bytes[i]);
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

function explainError(error, file) {
  const ext = getExtension(file.name).toUpperCase();
  if (error.message === "webp-unsupported") {
    return "This browser cannot encode WebP.";
  }
  if (error.message === "raw-codec-failed" || RAW_EXTENSIONS.has(getExtension(file.name))) {
    return `${ext} camera RAW decoding: could not extract preview or render raster.`;
  }
  if (error.message === "psd-codec-failed" || ["PSD", "PSB"].includes(ext)) {
    return "Photoshop (PSD/PSB) decoding requires internet access to load the PSD engine.";
  }
  if (error.message === "svg-codec-failed" || ext === "SVG" || ext === "SVGZ") {
    return "Unable to parse or render this SVG vector file.";
  }
  if (error.message === "tga-codec-failed" || ["TGA", "TARGA"].includes(ext)) {
    return "Unable to decode this TGA image format.";
  }
  if (error.message === "pbm-codec-failed" || ["PPM", "PGM", "PBM", "PNM"].includes(ext)) {
    return "Unable to decode this NetPBM image file.";
  }
  if (error.message === "heic-codec-failed" || ["HEIC", "HEIF", "HIF"].includes(ext)) {
    return "HEIC/HEIF decoding needs the lazy codec or browser support.";
  }
  if (error.message === "tiff-codec-failed" || ["TIFF", "TIF"].includes(ext)) {
    return "TIFF decoding needs the lazy codec or unsupported compression.";
  }
  if (error.message === "canvas-unavailable") {
    return "Canvas rendering is unavailable.";
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
  window.clearTimeout(state.toastTimer);
  dom.toast.textContent = message;
  dom.toast.classList.add("show");
  state.toastTimer = window.setTimeout(() => {
    dom.toast.classList.remove("show");
  }, 3200);
}
