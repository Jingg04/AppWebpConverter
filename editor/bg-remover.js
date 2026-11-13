/**
 * FluxWebP Pro — AI Automatic Background Remover & Refinement Engine
 * Architecture: Hybrid Client-Side Neural Model (ONNX Runtime Web / RMBG-1.4) +
 * Local Adaptive Saliency & GrabCut Matting Fallback + Interactive Refinement Studio.
 * Zero mandatory server uploads — 100% on-device client privacy.
 */

(function () {
  "use strict";

  // --- Engine Configuration & Model Endpoints ---
  const CONFIG = {
    ortCdn: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort.min.js",
    models: {
      rmbg: {
        name: "RMBG-1.4 (Deep Neural)",
        desc: "State-of-the-art general foreground segmentation for people, animals, products, vehicles & objects.",
        url: "https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model_quantized.onnx",
        inputSize: 1024,
        mean: [0.5, 0.5, 0.5],
        std: [1.0, 1.0, 1.0]
      },
      fast: {
        name: "Fast Saliency (Instant Local)",
        desc: "Pure on-device color clustering and boundary gradient matting. 0 MB download, instant execution.",
        url: null
      }
    }
  };

  // --- Capabilities Detector ---
  const Capabilities = {
    webgpu: false,
    wasm: typeof WebAssembly !== "undefined",
    threads: typeof SharedArrayBuffer !== "undefined",
    offscreen: typeof OffscreenCanvas !== "undefined",

    async detect() {
      if (typeof navigator !== "undefined" && navigator.gpu) {
        try {
          const adapter = await navigator.gpu.requestAdapter();
          this.webgpu = !!adapter;
        } catch (_) {
          this.webgpu = false;
        }
      }
      return {
        webgpu: this.webgpu,
        wasm: this.wasm,
        threads: this.threads,
        offscreen: this.offscreen
      };
    }
  };

  Capabilities.detect();

  // --- Global State for Background Removal Engine ---
  const state = {
    activeEngine: "rmbg", // "rmbg" | "fast" | "cloud"
    isProcessing: false,
    abortController: null,
    modelSession: null,
    modelLoading: false,
    modelProgress: 0,
    statusMessage: "",
    lastMask: null, // Canvas containing 8-bit grayscale mask
    originalSourceCanvas: null,

    // Refinement Studio State
    refinement: {
      isOpen: false,
      activeTool: "restore", // "restore" | "erase"
      brushSize: 32,
      brushHardness: 0.7,
      brushOpacity: 1.0,
      viewMode: "cutout", // "cutout" | "ruby" | "matte" | "backdrop"
      zoom: 100,
      panX: 0,
      panY: 0,
      isPanning: false,
      isPainting: false,
      lastPoint: null,
      feather: 0,
      smooth: 0,
      bgType: "transparent", // "transparent" | "white" | "black" | "color" | "gradient" | "custom_image"
      bgColor: "#FFFFFF",
      bgGradient: "studio-soft",
      bgCustomImage: null,
      history: [],
      historyIndex: -1
    },

    // Batch Removal Queue
    batch: {
      items: [],
      concurrency: 2,
      isRunning: false,
      sharedBg: "transparent",
      sharedBgColor: "#FFFFFF"
    }
  };

  // Studio Gradient Presets
  const GRADIENT_PRESETS = {
    "studio-soft": ["#E2E8F0", "#CBD5E1"],
    "clean-slate": ["#F8FAFC", "#E2E8F0"],
    "sunset-warmth": ["#FFEDD5", "#FED7AA"],
    "ocean-teal": ["#CCFBF1", "#99F6E4"],
    "electric-neon": ["#3B82F6", "#8B5CF6"],
    "dark-vignette": ["#1E293B", "#0F172A"],
    "rose-pastel": ["#FFE4E6", "#FECDD3"],
    "mint-fresh": ["#D1FAE5", "#A7F3D0"],
    "gold-luxury": ["#FEF08A", "#FDE047"],
    "midnight-purple": ["#4C1D95", "#1E1B4B"]
  };

  // --- Dynamic ONNX Runtime Web Loader ---
  let ortLoadingPromise = null;
  function loadOnnxRuntime() {
    if (window.ort && window.ort.InferenceSession) {
      return Promise.resolve(window.ort);
    }
    if (ortLoadingPromise) return ortLoadingPromise;

    ortLoadingPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = CONFIG.ortCdn;
      script.async = true;
      script.onload = () => {
        if (window.ort && window.ort.InferenceSession) {
          window.ort.env.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 2);
          window.ort.env.wasm.simd = true;
          resolve(window.ort);
        } else {
          reject(new Error("ONNX Runtime Web loaded without InferenceSession"));
        }
      };
      script.onerror = () => reject(new Error("Failed to load ONNX Runtime Web from CDN"));
      document.head.append(script);
    });

    return ortLoadingPromise;
  }

  // --- Neural Model Loader with CacheStorage Caching ---
  async function getNeuralModelSession(progressCallback) {
    if (state.modelSession) return state.modelSession;

    const modelCfg = CONFIG.models.rmbg;
    progressCallback?.({ stage: "init", message: "Loading ONNX Runtime Web engine..." });
    const ort = await loadOnnxRuntime();

    progressCallback?.({ stage: "download", message: "Fetching AI segmentation model weights (~43 MB)...", progress: 0 });

    // Check CacheStorage for cached model weights to avoid redownloading
    let modelBuffer = null;
    const cacheKey = "fluxwebp-ai-models-v1";
    try {
      if ("caches" in window) {
        const cache = await caches.open(cacheKey);
        const cachedRes = await cache.match(modelCfg.url);
        if (cachedRes) {
          progressCallback?.({ stage: "download", message: "Loading cached AI model from local storage...", progress: 100 });
          modelBuffer = await cachedRes.arrayBuffer();
        }
      }
    } catch (_) {}

    if (!modelBuffer) {
      const response = await fetch(modelCfg.url);
      if (!response.ok) throw new Error(`Model fetch failed with status ${response.status}`);

      const contentLength = Number(response.headers.get("content-length")) || 43000000;
      const reader = response.body.getReader();
      const chunks = [];
      let receivedBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedBytes += value.length;
        const pct = Math.min(99, Math.round((receivedBytes / contentLength) * 100));
        const mb = (receivedBytes / (1024 * 1024)).toFixed(1);
        progressCallback?.({
          stage: "download",
          message: `Downloading AI Model weights: ${mb} MB (${pct}%)...`,
          progress: pct
        });
      }

      const totalBlob = new Blob(chunks);
      modelBuffer = await totalBlob.arrayBuffer();

      // Cache model for future instant access
      try {
        if ("caches" in window) {
          const cache = await caches.open(cacheKey);
          await cache.put(modelCfg.url, new Response(totalBlob));
        }
      } catch (_) {}
    }

    progressCallback?.({ stage: "compile", message: "Compiling neural graph for hardware acceleration..." });

    // Choose execution provider: WebGPU if available, fallback to WASM
    const ep = Capabilities.webgpu ? ["webgpu", "wasm"] : ["wasm"];
    state.modelSession = await ort.InferenceSession.create(modelBuffer, {
      executionProviders: ep
    });

    return state.modelSession;
  }

  // --- Neural Inference Pipeline (RMBG-1.4) ---
  async function runNeuralSegmentation(sourceCanvas, progressCallback) {
    const session = await getNeuralModelSession(progressCallback);
    const ort = window.ort;
    const inputSize = CONFIG.models.rmbg.inputSize;

    progressCallback?.({ stage: "preprocess", message: "Preprocessing image tensor (1024×1024 RGB)..." });

    // Resize source to 1024x1024 input canvas
    const inputCanvas = document.createElement("canvas");
    inputCanvas.width = inputSize;
    inputCanvas.height = inputSize;
    const inCtx = inputCanvas.getContext("2d", { willReadFrequently: true });
    inCtx.drawImage(sourceCanvas, 0, 0, inputSize, inputSize);

    const imgData = inCtx.getImageData(0, 0, inputSize, inputSize);
    const pixels = imgData.data;
    const float32Data = new Float32Array(3 * inputSize * inputSize);

    // Planar RGB normalization: (r/255 - 0.5)/1.0
    const channelSize = inputSize * inputSize;
    for (let i = 0; i < channelSize; i++) {
      const pi = i * 4;
      float32Data[i] = (pixels[pi] / 255.0 - 0.5) / 1.0;                     // R
      float32Data[channelSize + i] = (pixels[pi + 1] / 255.0 - 0.5) / 1.0;   // G
      float32Data[2 * channelSize + i] = (pixels[pi + 2] / 255.0 - 0.5) / 1.0; // B
    }

    progressCallback?.({ stage: "inference", message: "Executing AI foreground detection..." });

    const inputTensor = new ort.Tensor("float32", float32Data, [1, 3, inputSize, inputSize]);
    const feeds = { [session.inputNames[0]]: inputTensor };
    const results = await session.run(feeds);
    const outputTensor = results[session.outputNames[0]];

    progressCallback?.({ stage: "postprocess", message: "Generating high-resolution alpha mask..." });

    // Output mask data is 1 x 1 x 1024 x 1024 float32 probabilities
    const outData = outputTensor.data;
    const mask1024Canvas = document.createElement("canvas");
    mask1024Canvas.width = inputSize;
    mask1024Canvas.height = inputSize;
    const m1024Ctx = mask1024Canvas.getContext("2d");
    const mImgData = m1024Ctx.createImageData(inputSize, inputSize);
    const mPixels = mImgData.data;

    for (let i = 0; i < channelSize; i++) {
      // Sigmoid/probability scaling
      let val = outData[i];
      val = Math.max(0, Math.min(1, val));
      const alpha = Math.round(val * 255);
      const pi = i * 4;
      mPixels[pi] = alpha;     // R
      mPixels[pi + 1] = alpha; // G
      mPixels[pi + 2] = alpha; // B
      mPixels[pi + 3] = 255;   // Opaque grayscale
    }
    m1024Ctx.putImageData(mImgData, 0, 0);

    // Rescale mask to original source dimensions
    const finalMaskCanvas = document.createElement("canvas");
    finalMaskCanvas.width = sourceCanvas.width;
    finalMaskCanvas.height = sourceCanvas.height;
    const fCtx = finalMaskCanvas.getContext("2d");
    fCtx.drawImage(mask1024Canvas, 0, 0, sourceCanvas.width, sourceCanvas.height);

    return finalMaskCanvas;
  }

  // --- Fast Adaptive Saliency & Color Segmentation (Instant Fallback) ---
  function runFastSaliencySegmentation(sourceCanvas, progressCallback) {
    progressCallback?.({ stage: "fast-analysis", message: "Analyzing foreground saliency & background color clusters..." });

    const w = sourceCanvas.width;
    const h = sourceCanvas.height;

    // Work on downscaled canvas for fast calculation
    const maxDim = 400;
    const scale = Math.min(1, maxDim / Math.max(w, h));
    const sw = Math.round(w * scale);
    const sh = Math.round(h * scale);

    const sCanvas = document.createElement("canvas");
    sCanvas.width = sw;
    sCanvas.height = sh;
    const sCtx = sCanvas.getContext("2d", { willReadFrequently: true });
    sCtx.drawImage(sourceCanvas, 0, 0, sw, sh);

    const imgData = sCtx.getImageData(0, 0, sw, sh);
    const data = imgData.data;

    // 1. Sample perimeter border pixels to identify dominant background color palette
    const bgSamples = [];
    const sampleBorder = (x, y) => {
      const idx = (y * sw + x) * 4;
      bgSamples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
    };

    const borderStep = Math.max(1, Math.floor(sw / 40));
    for (let x = 0; x < sw; x += borderStep) {
      sampleBorder(x, 0);
      sampleBorder(x, sh - 1);
    }
    for (let y = 0; y < sh; y += borderStep) {
      sampleBorder(0, y);
      sampleBorder(sw - 1, y);
    }

    // Average background color
    let avgR = 0, avgG = 0, avgB = 0;
    bgSamples.forEach((p) => { avgR += p.r; avgG += p.g; avgB += p.b; });
    avgR /= bgSamples.length;
    avgG /= bgSamples.length;
    avgB /= bgSamples.length;

    // 2. Compute spatial center bias and color distance map
    const saliency = new Float32Array(sw * sh);
    const cx = sw / 2;
    const cy = sh / 2;
    const maxDist = Math.hypot(cx, cy);

    let maxSal = 0;
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const i = y * sw + x;
        const pi = i * 4;
        const r = data[pi];
        const g = data[pi + 1];
        const b = data[pi + 2];

        // Euclidean color distance in RGB
        const colorDist = Math.hypot(r - avgR, g - avgG, b - avgB);

        // Center prior (subjects are usually centered)
        const centerDist = Math.hypot(x - cx, y - cy);
        const spatialWeight = 1 - (centerDist / maxDist) * 0.45;

        const sal = colorDist * spatialWeight;
        saliency[i] = sal;
        if (sal > maxSal) maxSal = sal;
      }
    }

    // 3. Otsu-inspired dynamic thresholding
    let sum = 0;
    for (let i = 0; i < saliency.length; i++) sum += saliency[i];
    const meanSal = sum / saliency.length;
    const threshold = meanSal * 0.85;

    // 4. Construct binary mask
    const maskSmallCanvas = document.createElement("canvas");
    maskSmallCanvas.width = sw;
    maskSmallCanvas.height = sh;
    const mCtx = maskSmallCanvas.getContext("2d");
    const mData = mCtx.createImageData(sw, sh);
    const mPix = mData.data;

    for (let i = 0; i < saliency.length; i++) {
      const val = saliency[i] >= threshold ? 255 : 0;
      const pi = i * 4;
      mPix[pi] = val;
      mPix[pi + 1] = val;
      mPix[pi + 2] = val;
      mPix[pi + 3] = 255;
    }
    mCtx.putImageData(mData, 0, 0);

    // 5. Morphological smoothing + feather scale-up to original resolution
    const finalMaskCanvas = document.createElement("canvas");
    finalMaskCanvas.width = w;
    finalMaskCanvas.height = h;
    const fCtx = finalMaskCanvas.getContext("2d");
    fCtx.filter = "blur(4px)";
    fCtx.drawImage(maskSmallCanvas, 0, 0, w, h);
    fCtx.filter = "none";

    return finalMaskCanvas;
  }

  // --- Hybrid Automatic Segmentation Pipeline ---
  async function removeBackground(sourceCanvas, options = {}) {
    const {
      engine = state.activeEngine,
      onProgress = null
    } = options;

    state.isProcessing = true;
    const startTime = performance.now();

    try {
      let maskCanvas = null;

      if (engine === "rmbg") {
        try {
          maskCanvas = await runNeuralSegmentation(sourceCanvas, onProgress);
        } catch (neuralErr) {
          console.warn("Neural RMBG inference failed or cancelled, falling back to Fast Saliency:", neuralErr);
          onProgress?.({
            stage: "fallback",
            message: "Neural model unavailable on this device. Switching to Fast Saliency Matting..."
          });
          maskCanvas = runFastSaliencySegmentation(sourceCanvas, onProgress);
        }
      } else {
        maskCanvas = runFastSaliencySegmentation(sourceCanvas, onProgress);
      }

      state.lastMask = maskCanvas;
      state.originalSourceCanvas = sourceCanvas;

      // Produce composite transparent image
      const resultCanvas = applyMaskToSource(sourceCanvas, maskCanvas);
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);

      onProgress?.({
        stage: "done",
        message: `Background removed successfully in ${elapsed}s!`,
        progress: 100
      });

      return {
        resultCanvas,
        maskCanvas,
        sourceCanvas,
        elapsed
      };
    } finally {
      state.isProcessing = false;
    }
  }

  // --- Apply Mask to Source (Pure Alpha Channel Composition) ---
  function applyMaskToSource(sourceCanvas, maskCanvas) {
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;

    const outCanvas = document.createElement("canvas");
    outCanvas.width = w;
    outCanvas.height = h;
    const outCtx = outCanvas.getContext("2d", { willReadFrequently: true });

    // Draw source
    outCtx.drawImage(sourceCanvas, 0, 0);

    // Apply mask via destination-in blend
    outCtx.globalCompositeOperation = "destination-in";
    outCtx.drawImage(maskCanvas, 0, 0, w, h);
    outCtx.globalCompositeOperation = "source-over";

    return outCanvas;
  }

  // --- Render Composition with Selected Background ---
  function renderWithBackground(sourceCanvas, maskCanvas, bgOptions = {}) {
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");

    const bgType = bgOptions.type || "transparent";

    // 1. Render Background
    if (bgType === "white") {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, w, h);
    } else if (bgType === "black") {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, w, h);
    } else if (bgType === "color") {
      ctx.fillStyle = bgOptions.color || "#FFFFFF";
      ctx.fillRect(0, 0, w, h);
    } else if (bgType === "gradient") {
      const colors = GRADIENT_PRESETS[bgOptions.gradient] || GRADIENT_PRESETS["studio-soft"];
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, colors[0]);
      grad.addColorStop(1, colors[1]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else if (bgType === "custom_image" && bgOptions.customImage) {
      ctx.drawImage(bgOptions.customImage, 0, 0, w, h);
    }
    // "transparent" leaves canvas clean

    // 2. Render Cutout Foreground
    const cutout = applyMaskToSource(sourceCanvas, maskCanvas);
    ctx.drawImage(cutout, 0, 0);

    return canvas;
  }

  // --- Mask Refinement Brush & Edge Operations ---
  const MaskOperations = {
    // Paint on mask: restore (white = opaque) or erase (black = transparent)
    paintBrush(maskCanvas, x, y, options = {}) {
      const {
        action = "restore", // "restore" | "erase"
        radius = 16,
        hardness = 0.5,
        opacity = 1.0
      } = options;

      const mCtx = maskCanvas.getContext("2d");
      mCtx.save();

      const color = action === "restore" ? "255, 255, 255" : "0, 0, 0";

      if (hardness >= 0.95) {
        mCtx.fillStyle = `rgba(${color}, ${opacity})`;
        mCtx.beginPath();
        mCtx.arc(x, y, radius, 0, Math.PI * 2);
        mCtx.fill();
      } else {
        const grad = mCtx.createRadialGradient(x, y, radius * hardness, x, y, radius);
        grad.addColorStop(0, `rgba(${color}, ${opacity})`);
        grad.addColorStop(1, `rgba(${color}, 0)`);

        mCtx.fillStyle = grad;
        mCtx.beginPath();
        mCtx.arc(x, y, radius, 0, Math.PI * 2);
        mCtx.fill();
      }

      mCtx.restore();
    },

    // Paint connected stroke between two points
    paintStroke(maskCanvas, x1, y1, x2, y2, options = {}) {
      const dist = Math.hypot(x2 - x1, y2 - y1);
      const step = Math.max(1, (options.radius || 16) * 0.25);
      const count = Math.ceil(dist / step);

      for (let i = 0; i <= count; i++) {
        const t = count === 0 ? 0 : i / count;
        const x = x1 + (x2 - x1) * t;
        const y = y1 + (y2 - y1) * t;
        this.paintBrush(maskCanvas, x, y, options);
      }
    },

    // Invert mask: foreground becomes background and vice-versa
    invertMask(maskCanvas) {
      const ctx = maskCanvas.getContext("2d", { willReadFrequently: true });
      const imgData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      const pix = imgData.data;

      for (let i = 0; i < pix.length; i += 4) {
        const inv = 255 - pix[i];
        pix[i] = inv;
        pix[i + 1] = inv;
        pix[i + 2] = inv;
      }
      ctx.putImageData(imgData, 0, 0);
    },

    // Feather edges: apply Gaussian blur filter on mask canvas
    applyFeather(maskCanvas, radius = 2) {
      if (radius <= 0) return;
      const copy = document.createElement("canvas");
      copy.width = maskCanvas.width;
      copy.height = maskCanvas.height;
      copy.getContext("2d").drawImage(maskCanvas, 0, 0);

      const ctx = maskCanvas.getContext("2d");
      ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      ctx.filter = `blur(${radius}px)`;
      ctx.drawImage(copy, 0, 0);
      ctx.filter = "none";
    },

    // Clone mask canvas
    cloneMask(maskCanvas) {
      const clone = document.createElement("canvas");
      clone.width = maskCanvas.width;
      clone.height = maskCanvas.height;
      clone.getContext("2d").drawImage(maskCanvas, 0, 0);
      return clone;
    }
  };

  // --- Batch Processing Orchestrator ---
  async function runBatchRemoval(filesOrItems, options = {}) {
    const {
      onItemStart,
      onItemProgress,
      onItemDone,
      onError,
      concurrency = 2,
      engine = state.activeEngine
    } = options;

    const queue = [...filesOrItems];
    const results = [];
    let activeWorkers = 0;

    return new Promise((resolve) => {
      function next() {
        if (queue.length === 0 && activeWorkers === 0) {
          resolve(results);
          return;
        }

        while (activeWorkers < concurrency && queue.length > 0) {
          const item = queue.shift();
          activeWorkers++;
          onItemStart?.(item);

          // Convert item to image/canvas
          loadImageElement(item)
            .then((img) => {
              const canvas = document.createElement("canvas");
              canvas.width = img.naturalWidth || img.width;
              canvas.height = img.naturalHeight || img.height;
              canvas.getContext("2d").drawImage(img, 0, 0);

              return removeBackground(canvas, {
                engine,
                onProgress: (p) => onItemProgress?.(item, p)
              });
            })
            .then((res) => {
              results.push({ item, ...res, success: true });
              onItemDone?.(item, res);
            })
            .catch((err) => {
              results.push({ item, error: err.message, success: false });
              onError?.(item, err);
            })
            .finally(() => {
              activeWorkers--;
              next();
            });
        }
      }

      next();
    });
  }

  function loadImageElement(source) {
    return new Promise((resolve, reject) => {
      if (source instanceof HTMLImageElement || source instanceof HTMLCanvasElement) {
        resolve(source);
        return;
      }
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;

      if (source instanceof Blob || source instanceof File) {
        img.src = URL.createObjectURL(source);
      } else if (typeof source === "string") {
        img.src = source;
      } else if (source.file) {
        img.src = URL.createObjectURL(source.file);
      } else {
        reject(new Error("Unsupported source object for background removal"));
      }
    });
  }

  // --- Export Global API ---
  window.FluxBgRemover = {
    version: "1.0.0",
    getState: () => state,
    getCapabilities: () => Capabilities,
    getGradientPresets: () => GRADIENT_PRESETS,
    loadOnnxRuntime,
    getNeuralModelSession,
    removeBackground,
    runNeuralSegmentation,
    runFastSaliencySegmentation,
    applyMaskToSource,
    renderWithBackground,
    MaskOperations,
    runBatchRemoval
  };
})();

