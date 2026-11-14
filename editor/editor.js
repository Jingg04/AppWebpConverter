/**
 * FluxWebP Pro — Professional In-Browser Image Editor Engine
 * Architecture: Non-destructive multi-layer composition canvas,
 * real pixel adjustments, vector text & shapes, crop, resize, and multi-format export.
 */

(function () {
  "use strict";

  // --- Document & State Definition ---
  const state = {
    doc: {
      id: makeId(),
      name: "flux-edited-photo",
      width: 1200,
      height: 800,
      backgroundColor: "transparent",
      backgroundType: "transparent",
      bgColorVal: "#FFFFFF",
      transform: {
        rotation: 0,
        flipH: false,
        flipV: false
      },
      adjustments: {
        brightness: 100, // 0 - 200
        contrast: 100,   // 0 - 200
        exposure: 0,     // -100 to 100
        saturation: 100, // 0 - 200
        temperature: 0,  // -100 to 100
        tint: 0,         // -100 to 100
        sharpness: 0,    // 0 to 100
        blur: 0,         // 0 to 50
        vignette: 0      // 0 to 100
      },
      filter: "none",
      filterIntensity: 100,
      layers: []
    },
    view: {
      zoom: 1,
      panX: 0,
      panY: 0,
      isPanning: false,
      panStartX: 0,
      panStartY: 0
    },
    activeTool: "select",
    selectedLayerId: null,
    dragHandle: null,
    dragStartX: 0,
    dragStartY: 0,
    layerStartTransform: null,
    crop: {
      active: false,
      x: 50,
      y: 50,
      w: 800,
      h: 600,
      aspect: "free",
      dragAction: null,
      startX: 0,
      startY: 0
    },
    draw: {
      isDrawing: false,
      mode: "brush", // 'brush' | 'eraser'
      size: 12,
      color: "#E53935",
      currentStroke: null
    },
    history: [],
    historyIndex: -1,
    isOriginalComparing: false,
    renderPending: false
  };

  // --- DOM References ---
  const dom = {
    canvas: document.getElementById("editorCanvas"),
    stage: document.getElementById("canvasStage"),
    viewport: document.getElementById("editorViewport"),
    transformBox: document.getElementById("transformBox"),
    cropOverlay: document.getElementById("cropOverlay"),
    cropBox: document.getElementById("cropBox"),
    emptyOverlay: document.getElementById("editorEmptyOverlay"),
    dropZone: document.getElementById("editorDropZone"),
    fileInput: document.getElementById("editorFileInput"),
    landingBrowseBtn: document.getElementById("landingBrowseBtn"),
    projectTitleInput: document.getElementById("projectTitleInput"),
    docDimPill: document.getElementById("docDimPill"),
    toastContainer: document.getElementById("toastContainer"),
    
    // Header actions
    undoBtn: document.getElementById("undoBtn"),
    redoBtn: document.getElementById("redoBtn"),
    resetAllBtn: document.getElementById("resetAllBtn"),
    compareOriginalBtn: document.getElementById("compareOriginalBtn"),
    openImageBtn: document.getElementById("openImageBtn"),
    saveProjBtn: document.getElementById("saveProjBtn"),
    headerExportBtn: document.getElementById("headerExportBtn"),
    themeToggleBtn: document.getElementById("themeToggleBtn"),

    // Viewport controls
    zoomLabel: document.getElementById("zoomLabel"),
    zoomInBtn: document.getElementById("zoomInBtn"),
    zoomOutBtn: document.getElementById("zoomOutBtn"),
    zoomFitBtn: document.getElementById("zoomFitBtn"),
    zoomResetBtn: document.getElementById("zoomResetBtn"),

    // Tool icons & subpanels
    subpanel: document.getElementById("editorSubpanel"),
    toolButtons: document.querySelectorAll(".tool-icon-btn"),
    subpanels: {
      select: document.getElementById("subpanelSelect"),
      crop: document.getElementById("subpanelCrop"),
      resize: document.getElementById("subpanelResize"),
      transform: document.getElementById("subpanelTransform"),
      adjust: document.getElementById("subpanelAdjust"),
      filter: document.getElementById("subpanelFilter"),
      text: document.getElementById("subpanelText"),
      shapes: document.getElementById("subpanelShapes"),
      draw: document.getElementById("subpanelDraw"),
      watermark: document.getElementById("subpanelWatermark"),
      background: document.getElementById("subpanelBackground"),
      "bg-remover": document.getElementById("subpanelBgRemover")
    },

    // Crop subpanel
    cropAspectBtns: document.querySelectorAll(".aspect-btn[data-aspect]"),
    cropWidthInput: document.getElementById("cropWidthInput"),
    cropHeightInput: document.getElementById("cropHeightInput"),
    applyCropBtn: document.getElementById("applyCropBtn"),
    cancelCropBtn: document.getElementById("cancelCropBtn"),

    // Resize subpanel
    resizePresetSelect: document.getElementById("resizePresetSelect"),
    resizeWInput: document.getElementById("resizeWInput"),
    resizeHInput: document.getElementById("resizeHInput"),
    resizeAspectLock: document.getElementById("resizeAspectLock"),
    applyResizeBtn: document.getElementById("applyResizeBtn"),

    // Rotate/Flip subpanel
    rotateCcwBtn: document.getElementById("rotateCcwBtn"),
    rotateCwBtn: document.getElementById("rotateCwBtn"),
    flipHorizontalBtn: document.getElementById("flipHorizontalBtn"),
    flipVerticalBtn: document.getElementById("flipVerticalBtn"),
    freeRotateRange: document.getElementById("freeRotateRange"),
    freeRotateVal: document.getElementById("freeRotateVal"),

    // Adjustments
    resetAdjustmentsBtn: document.getElementById("resetAdjustmentsBtn"),
    adjInputs: {
      brightness: { range: document.getElementById("adjBrightness"), num: document.getElementById("adjBrightnessVal") },
      contrast: { range: document.getElementById("adjContrast"), num: document.getElementById("adjContrastVal") },
      exposure: { range: document.getElementById("adjExposure"), num: document.getElementById("adjExposureVal") },
      saturation: { range: document.getElementById("adjSaturation"), num: document.getElementById("adjSaturationVal") },
      temp: { range: document.getElementById("adjTemp"), num: document.getElementById("adjTempVal") },
      tint: { range: document.getElementById("adjTint"), num: document.getElementById("adjTintVal") },
      sharpness: { range: document.getElementById("adjSharpness"), num: document.getElementById("adjSharpnessVal") },
      blur: { range: document.getElementById("adjBlur"), num: document.getElementById("adjBlurVal") },
      vignette: { range: document.getElementById("adjVignette"), num: document.getElementById("adjVignetteVal") }
    },

    // Filter subpanel
    filterCards: document.querySelectorAll(".filter-preset-card"),
    filterIntensityRange: document.getElementById("filterIntensityRange"),
    filterIntensityVal: document.getElementById("filterIntensityVal"),

    // Text subpanel
    addTextLayerBtn: document.getElementById("addTextLayerBtn"),
    textLayerInput: document.getElementById("textLayerInput"),
    textFontSelect: document.getElementById("textFontSelect"),
    textSizeInput: document.getElementById("textSizeInput"),
    textColorInput: document.getElementById("textColorInput"),
    textBoldBtn: document.getElementById("textBoldBtn"),
    textItalicBtn: document.getElementById("textItalicBtn"),
    textAlignLeftBtn: document.getElementById("textAlignLeftBtn"),
    textAlignCenterBtn: document.getElementById("textAlignCenterBtn"),
    textAlignRightBtn: document.getElementById("textAlignRightBtn"),

    // Shapes subpanel
    shapeBtns: document.querySelectorAll(".shape-btn"),
    shapeFillColor: document.getElementById("shapeFillColor"),
    shapeStrokeColor: document.getElementById("shapeStrokeColor"),
    shapeStrokeWidth: document.getElementById("shapeStrokeWidth"),

    // Draw subpanel
    brushModeBtn: document.getElementById("brushModeBtn"),
    eraserModeBtn: document.getElementById("eraserModeBtn"),
    brushSizeInput: document.getElementById("brushSizeInput"),
    brushColorInput: document.getElementById("brushColorInput"),
    clearDrawingBtn: document.getElementById("clearDrawingBtn"),

    // Watermark subpanel
    watermarkTextInput: document.getElementById("watermarkTextInput"),
    watermarkAnchorBtns: document.querySelectorAll("[data-anchor]"),
    watermarkOpacityRange: document.getElementById("watermarkOpacityRange"),
    applyWatermarkBtn: document.getElementById("applyWatermarkBtn"),

    // Background subpanel
    bgTypeSelect: document.getElementById("bgTypeSelect"),
    bgColorGroup: document.getElementById("bgColorGroup"),
    bgColorInput: document.getElementById("bgColorInput"),

    // Right inspector panel
    rightPanel: document.getElementById("editorRightPanel"),
    panelTabBtns: document.querySelectorAll(".panel-tab-btn"),
    tabContents: {
      properties: document.getElementById("tabProperties"),
      layers: document.getElementById("tabLayers"),
      history: document.getElementById("tabHistory"),
      export: document.getElementById("tabExport")
    },
    layersList: document.getElementById("layersList"),
    historyStackList: document.getElementById("historyStackList"),
    layerCountBadge: document.getElementById("layerCountBadge"),
    bringForwardBtn: document.getElementById("bringForwardBtn"),
    sendBackwardBtn: document.getElementById("sendBackwardBtn"),
    deleteSelectedLayerBtn: document.getElementById("deleteSelectedLayerBtn"),
    addBlankLayerBtn: document.getElementById("addBlankLayerBtn"),
    duplicateLayerBtn: document.getElementById("duplicateLayerBtn"),

    // Layer Properties controls
    propLayerName: document.getElementById("propLayerName"),
    propPosX: document.getElementById("propPosX"),
    propPosY: document.getElementById("propPosY"),
    propOpacity: document.getElementById("propOpacity"),
    propOpacityVal: document.getElementById("propOpacityVal"),

    // Export controls
    exportFormatSelect: document.getElementById("exportFormatSelect"),
    exportQualityGroup: document.getElementById("exportQualityGroup"),
    exportQualityRange: document.getElementById("exportQualityRange"),
    exportQualityVal: document.getElementById("exportQualityVal"),
    exportTargetSize: document.getElementById("exportTargetSize"),
    exportFilenameInput: document.getElementById("exportFilenameInput"),
    downloadExportedBtn: document.getElementById("downloadExportedBtn"),
    openInConverterBtn: document.getElementById("openInConverterBtn"),
    copyClipboardBtn: document.getElementById("copyClipboardBtn"),

    // Landing samples
    emptyOverlayCloseBtn: document.getElementById("emptyOverlayCloseBtn"),
    loadBlankCanvasBtn: document.getElementById("loadBlankCanvasBtn"),
    loadSampleLandscapeBtn: document.getElementById("loadSampleLandscapeBtn"),
    loadSamplePortraitBtn: document.getElementById("loadSamplePortraitBtn"),
    loadSampleCutoutBtn: document.getElementById("loadSampleCutoutBtn"),
    pasteClipboardLandingBtn: document.getElementById("pasteClipboardLandingBtn"),

    // Background remover subpanel & buttons
    btnHeaderRemoveBg: document.getElementById("btnHeaderRemoveBg"),
    toolBtnBgRemover: document.getElementById("toolBtnBgRemover"),
    bgRemoverEngineSelect: document.getElementById("bgRemoverEngineSelect"),
    engineDescText: document.getElementById("engineDescText"),
    btnRunBgRemoval: document.getElementById("btnRunBgRemoval"),
    bgRemovalProgressWrap: document.getElementById("bgRemovalProgressWrap"),
    bgRemovalProgressBar: document.getElementById("bgRemovalProgressBar"),
    bgRemovalStatusText: document.getElementById("bgRemovalStatusText"),
    bgRemovalCancelBtn: document.getElementById("bgRemovalCancelBtn"),
    btnOpenRefinementStudio: document.getElementById("btnOpenRefinementStudio"),
    inspectorRemoveBgBtn: document.getElementById("inspectorRemoveBgBtn"),
    bgOptBtns: document.querySelectorAll(".bg-opt-btn[data-bg-type]"),
    replaceBgColorInput: document.getElementById("replaceBgColorInput"),
    replaceGradientGroup: document.getElementById("replaceGradientGroup"),
    gradientPresetPills: document.getElementById("gradientPresetPills"),
    replaceCustomImageGroup: document.getElementById("replaceCustomImageGroup"),
    replaceCustomImageFile: document.getElementById("replaceCustomImageFile"),
    btnOpenBatchBgModal: document.getElementById("btnOpenBatchBgModal"),

    // Refinement Studio Modal
    refinementModal: document.getElementById("refinementModal"),
    refineViewTabs: document.querySelectorAll(".view-tab[data-view]"),
    refineUndoBtn: document.getElementById("refineUndoBtn"),
    refineRedoBtn: document.getElementById("refineRedoBtn"),
    refineCancelBtn: document.getElementById("refineCancelBtn"),
    refineApplyBtn: document.getElementById("refineApplyBtn"),
    btnBrushRestore: document.getElementById("btnBrushRestore"),
    btnBrushErase: document.getElementById("btnBrushErase"),
    refineBrushSize: document.getElementById("refineBrushSize"),
    refineBrushSizeVal: document.getElementById("refineBrushSizeVal"),
    refineBrushHardness: document.getElementById("refineBrushHardness"),
    refineBrushHardnessVal: document.getElementById("refineBrushHardnessVal"),
    refineBrushOpacity: document.getElementById("refineBrushOpacity"),
    refineBrushOpacityVal: document.getElementById("refineBrushOpacityVal"),
    refineFeather: document.getElementById("refineFeather"),
    refineFeatherVal: document.getElementById("refineFeatherVal"),
    refineInvertMaskBtn: document.getElementById("refineInvertMaskBtn"),
    refineResetMaskBtn: document.getElementById("refineResetMaskBtn"),
    refineRerunAiBtn: document.getElementById("refineRerunAiBtn"),
    refinementStage: document.getElementById("refinementStage"),
    refinementCanvas: document.getElementById("refinementCanvas"),
    brushCursor: document.getElementById("brushCursor"),
    refineZoomBadge: document.getElementById("refineZoomBadge"),

    // Batch Modal
    batchBgModal: document.getElementById("batchBgModal"),
    batchBgDropzone: document.getElementById("batchBgDropzone"),
    batchBgUploadTrigger: document.getElementById("batchBgUploadTrigger"),
    batchBgFileInput: document.getElementById("batchBgFileInput"),
    batchSharedBgSelect: document.getElementById("batchSharedBgSelect"),
    btnStartBatchBg: document.getElementById("btnStartBatchBg"),
    btnDownloadBatchBgZip: document.getElementById("btnDownloadBatchBgZip"),
    batchBgItemsList: document.getElementById("batchBgItemsList")
  };

  const ctx = dom.canvas.getContext("2d", { willReadFrequently: true });

  // --- Initial Launch Setup ---
  initTheme();
  bindEvents();
  initEmptyState();

  // --- Theme Management ---
  function initTheme() {
    const saved = localStorage.getItem("fluxwebp-theme");
    if (saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.dataset.theme = "dark";
    } else {
      document.documentElement.dataset.theme = "light";
    }
  }

  function toggleTheme() {
    const current = document.documentElement.dataset.theme;
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("fluxwebp-theme", next);
  }

  // --- Document Initialization ---
  function initDocumentWithImage(imgOrCanvas, name = "Photo") {
    const w = imgOrCanvas.naturalWidth || imgOrCanvas.width || 1200;
    const h = imgOrCanvas.naturalHeight || imgOrCanvas.height || 800;

    state.doc.width = w;
    state.doc.height = h;
    state.doc.name = name.replace(/\.[^/.]+$/, "");
    dom.projectTitleInput.value = state.doc.name;
    dom.exportFilenameInput.value = state.doc.name;
    updateDimPill();

    // Base raster image layer
    const baseLayer = {
      id: "layer_base",
      name: "Original Image",
      type: "image",
      visible: true,
      locked: false,
      opacity: 1,
      x: 0,
      y: 0,
      width: w,
      height: h,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      source: imgOrCanvas,
      originalSource: imgOrCanvas
    };

    state.doc.layers = [baseLayer];
    state.selectedLayerId = baseLayer.id;
    state.doc.transform = { rotation: 0, flipH: false, flipV: false };
    resetAdjustmentsState();

    // Reset Crop
    state.crop.active = false;
    dom.cropOverlay.classList.add("hidden");

    // Hide empty state
    dom.emptyOverlay.classList.add("hidden");

    // Clear and push initial history snapshot
    state.history = [];
    state.historyIndex = -1;
    pushHistory("Open Image");

    fitCanvasToViewport();
    requestRender();
    renderLayersList();
    showToast(`Loaded ${escapeHtml(name)} (${w}×${h}px)`);
  }

  function updateDimPill() {
    dom.docDimPill.textContent = `${state.doc.width} × ${state.doc.height}px`;
    dom.resizeWInput.value = state.doc.width;
    dom.resizeHInput.value = state.doc.height;
  }

  // --- Canvas Rendering Pipeline ---
  function requestRender() {
    if (state.renderPending) return;
    state.renderPending = true;
    requestAnimationFrame(() => {
      state.renderPending = false;
      renderCanvas();
      updateTransformBox();
    });
  }

  function renderCanvas() {
    const { width, height } = state.doc;
    if (dom.canvas.width !== width || dom.canvas.height !== height) {
      dom.canvas.width = width;
      dom.canvas.height = height;
    }

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // 1. Background Fill
    if (state.doc.backgroundType === "color") {
      ctx.fillStyle = state.doc.bgColorVal || "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
    } else if (state.doc.backgroundType === "gradient") {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#2563EB");
      grad.addColorStop(1, "#F97316");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    // 2. Global Document Transform (Rotate / Flip)
    ctx.translate(width / 2, height / 2);
    if (state.doc.transform.rotation !== 0) {
      ctx.rotate((state.doc.transform.rotation * Math.PI) / 180);
    }
    if (state.doc.transform.flipH || state.doc.transform.flipV) {
      ctx.scale(state.doc.transform.flipH ? -1 : 1, state.doc.transform.flipV ? -1 : 1);
    }
    ctx.translate(-width / 2, -height / 2);

    // 3. Render Layers Bottom-to-Top
    state.doc.layers.forEach((layer) => {
      if (!layer.visible) return;
      ctx.save();
      ctx.globalAlpha = Number(layer.opacity ?? 1);

      // Layer translation & rotation
      const cx = layer.x + layer.width / 2;
      const cy = layer.y + layer.height / 2;
      ctx.translate(cx, cy);
      if (layer.rotation) ctx.rotate((layer.rotation * Math.PI) / 180);
      if (layer.scaleX !== 1 || layer.scaleY !== 1) ctx.scale(layer.scaleX || 1, layer.scaleY || 1);
      ctx.translate(-layer.width / 2, -layer.height / 2);

      if (layer.type === "image") {
        renderImageLayer(layer);
      } else if (layer.type === "text") {
        renderTextLayer(layer);
      } else if (layer.type === "shape") {
        renderShapeLayer(layer);
      } else if (layer.type === "drawing") {
        renderDrawingLayer(layer);
      } else if (layer.type === "watermark") {
        renderWatermarkLayer(layer);
      }

      ctx.restore();
    });

    // 4. In-Progress Freehand Drawing Stroke Preview
    if (state.draw.isDrawing && state.draw.currentStroke && state.draw.currentStroke.points.length > 1) {
      renderActiveStroke(state.draw.currentStroke);
    }

    ctx.restore();

    // 5. Update Crop Box position if active
    if (state.crop.active) {
      updateCropBoxDom();
    }
  }

  function renderImageLayer(layer) {
    if (!layer.source) return;

    // Render Layer-specific background replacement if configured
    if (layer.bgType && layer.bgType !== "transparent") {
      ctx.save();
      if (layer.bgType === "white") {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, layer.width, layer.height);
      } else if (layer.bgType === "black") {
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, layer.width, layer.height);
      } else if (layer.bgType === "color") {
        ctx.fillStyle = layer.bgColor || "#FFFFFF";
        ctx.fillRect(0, 0, layer.width, layer.height);
      } else if (layer.bgType === "gradient") {
        const colors = window.FluxBgRemover?.getGradientPresets()?.[layer.bgGradient || "studio-soft"] || ["#E2E8F0", "#CBD5E1"];
        const grad = ctx.createLinearGradient(0, 0, 0, layer.height);
        grad.addColorStop(0, colors[0]);
        grad.addColorStop(1, colors[1]);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, layer.width, layer.height);
      } else if (layer.bgType === "custom_image" && layer.bgCustomImage) {
        ctx.drawImage(layer.bgCustomImage, 0, 0, layer.width, layer.height);
      }
      ctx.restore();
    }

    // Apply adjustments & filters only if not comparing original
    if (!state.isOriginalComparing && (layer.id === "layer_base" || layer.hasAdjustments)) {
      ctx.save();
      const filterStr = buildCssFilterString(state.doc.adjustments, state.doc.filter, state.doc.filterIntensity);
      if (filterStr) ctx.filter = filterStr;
      ctx.drawImage(layer.source, 0, 0, layer.width, layer.height);
      ctx.restore();

      // Vignette effect post-pass
      if (state.doc.adjustments.vignette > 0) {
        renderVignettePass(layer.width, layer.height, state.doc.adjustments.vignette);
      }
    } else {
      ctx.drawImage(layer.source, 0, 0, layer.width, layer.height);
    }
  }

  function renderTextLayer(layer) {
    ctx.font = `${layer.fontStyle || "normal"} ${layer.fontWeight || 400} ${layer.fontSize || 48}px ${layer.fontFamily || "Inter, sans-serif"}`;
    ctx.textAlign = layer.textAlign || "left";
    ctx.textBaseline = "top";

    if (layer.shadow?.enabled) {
      ctx.shadowColor = layer.shadow.color || "rgba(0,0,0,0.5)";
      ctx.shadowBlur = layer.shadow.blur || 4;
      ctx.shadowOffsetX = layer.shadow.offsetX || 2;
      ctx.shadowOffsetY = layer.shadow.offsetY || 2;
    }

    if (layer.backgroundColor && layer.backgroundColor !== "transparent") {
      ctx.fillStyle = layer.backgroundColor;
      ctx.fillRect(0, 0, layer.width, layer.height);
    }

    ctx.fillStyle = layer.color || "#FFFFFF";
    const lines = (layer.text || "").split("\n");
    const lh = (layer.fontSize || 48) * (layer.lineHeight || 1.2);

    lines.forEach((line, i) => {
      let xPos = 0;
      if (layer.textAlign === "center") xPos = layer.width / 2;
      else if (layer.textAlign === "right") xPos = layer.width;
      ctx.fillText(line, xPos, i * lh);
    });
  }

  function renderShapeLayer(layer) {
    ctx.fillStyle = layer.fillColor || "#2563EB";
    ctx.strokeStyle = layer.strokeColor || "#FFFFFF";
    ctx.lineWidth = Number(layer.strokeWidth || 0);

    const w = layer.width;
    const h = layer.height;

    ctx.beginPath();
    switch (layer.shapeType) {
      case "circle":
      case "ellipse":
        ctx.ellipse(w / 2, h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
        break;
      case "rounded":
        const r = Math.min(w, h) * 0.15;
        ctx.roundRect(0, 0, w, h, [r]);
        break;
      case "arrow":
        renderArrowShape(w, h);
        break;
      case "rectangle":
      default:
        ctx.rect(0, 0, w, h);
        break;
    }

    if (layer.fillColor && layer.fillColor !== "transparent") ctx.fill();
    if (layer.strokeWidth > 0) ctx.stroke();
  }

  function renderArrowShape(w, h) {
    const headW = Math.min(w * 0.35, 40);
    const shaftH = h * 0.3;
    const shaftTop = (h - shaftH) / 2;
    ctx.moveTo(0, shaftTop);
    ctx.lineTo(w - headW, shaftTop);
    ctx.lineTo(w - headW, 0);
    ctx.lineTo(w, h / 2);
    ctx.lineTo(w - headW, h);
    ctx.lineTo(w - headW, shaftTop + shaftH);
    ctx.lineTo(0, shaftTop + shaftH);
    ctx.closePath();
  }

  function renderDrawingLayer(layer) {
    if (!layer.strokes) return;
    layer.strokes.forEach((stroke) => renderActiveStroke(stroke));
  }

  function renderActiveStroke(stroke) {
    if (!stroke.points || stroke.points.length < 2) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = stroke.size || 12;
    ctx.strokeStyle = stroke.color || "#E53935";
    ctx.globalCompositeOperation = stroke.mode === "eraser" ? "destination-out" : "source-over";

    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function renderWatermarkLayer(layer) {
    ctx.save();
    ctx.globalAlpha = layer.opacity || 0.7;
    ctx.font = `600 ${layer.fontSize || 32}px Inter, sans-serif`;
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.textBaseline = "middle";
    ctx.fillText(layer.text || "© FluxWebP Pro", 10, layer.height / 2);
    ctx.restore();
  }

  function renderVignettePass(w, h, strength) {
    ctx.save();
    const factor = strength / 100;
    const maxR = Math.hypot(w / 2, h / 2);
    const grad = ctx.createRadialGradient(w / 2, h / 2, maxR * 0.4, w / 2, h / 2, maxR);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, `rgba(0,0,0,${0.85 * factor})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // --- Real CSS / Canvas Filter String Generator ---
  function buildCssFilterString(adj, filterType, intensity = 100) {
    const filters = [];

    // Basic adjustments
    if (adj.brightness !== 100) filters.push(`brightness(${adj.brightness}%)`);
    if (adj.contrast !== 100) filters.push(`contrast(${adj.contrast}%)`);
    if (adj.saturation !== 100) filters.push(`saturate(${adj.saturation}%)`);
    if (adj.exposure !== 0) {
      const expVal = 100 + adj.exposure * 0.8;
      filters.push(`brightness(${expVal}%)`);
    }
    if (adj.blur > 0) filters.push(`blur(${adj.blur}px)`);

    // Temperature & Tint via hue rotation & sepia color blends
    if (adj.temperature !== 0) {
      if (adj.temperature > 0) filters.push(`sepia(${adj.temperature * 0.35}%)`);
      else filters.push(`hue-rotate(${adj.temperature * 0.4}deg)`);
    }
    if (adj.tint !== 0) {
      filters.push(`hue-rotate(${adj.tint * 0.5}deg)`);
    }

    // Filter Presets
    const ratio = intensity / 100;
    switch (filterType) {
      case "natural":
        filters.push(`contrast(${100 + 10 * ratio}%) saturate(${100 + 15 * ratio}%)`);
        break;
      case "warm":
        filters.push(`sepia(${25 * ratio}%) saturate(${100 + 15 * ratio}%)`);
        break;
      case "cool":
        filters.push(`hue-rotate(${-15 * ratio}deg) saturate(${100 + 10 * ratio}%)`);
        break;
      case "vivid":
        filters.push(`contrast(${100 + 25 * ratio}%) saturate(${100 + 40 * ratio}%)`);
        break;
      case "soft":
        filters.push(`contrast(${100 - 10 * ratio}%) brightness(${100 + 8 * ratio}%)`);
        break;
      case "grayscale":
        filters.push(`grayscale(${100 * ratio}%)`);
        break;
      case "bw":
        filters.push(`grayscale(${100 * ratio}%) contrast(${100 + 45 * ratio}%)`);
        break;
      case "sepia":
        filters.push(`sepia(${85 * ratio}%) contrast(${100 + 5 * ratio}%)`);
        break;
      case "vintage":
        filters.push(`sepia(${35 * ratio}%) contrast(${100 + 10 * ratio}%) brightness(${95}%)`);
        break;
      case "cinematic":
        filters.push(`contrast(${100 + 20 * ratio}%) saturate(${100 + 20 * ratio}%) hue-rotate(${10 * ratio}deg)`);
        break;
      case "high_contrast":
        filters.push(`contrast(${100 + 50 * ratio}%)`);
        break;
    }

    return filters.join(" ");
  }

  // --- Zoom, Pan & Viewport Transformation ---
  function updateViewportTransform() {
    dom.stage.style.width = `${state.doc.width}px`;
    dom.stage.style.height = `${state.doc.height}px`;
    dom.stage.style.transform = `translate(${state.view.panX}px, ${state.view.panY}px) scale(${state.view.zoom})`;
    dom.zoomLabel.textContent = `${Math.round(state.view.zoom * 100)}%`;
  }

  function fitCanvasToViewport() {
    const vpRect = dom.viewport.getBoundingClientRect();
    const margin = 40;
    const availW = Math.max(100, vpRect.width - margin * 2);
    const availH = Math.max(100, vpRect.height - margin * 2);

    const scaleW = availW / state.doc.width;
    const scaleH = availH / state.doc.height;
    state.view.zoom = Math.min(scaleW, scaleH, 1.0);
    state.view.panX = 0;
    state.view.panY = 0;
    updateViewportTransform();
  }

  function setZoom(newZoom) {
    state.view.zoom = Math.max(0.1, Math.min(5.0, newZoom));
    updateViewportTransform();
  }

  // --- Interactive Selection Bounding Box ---
  function updateTransformBox() {
    const layer = getSelectedLayer();
    if (!layer || state.activeTool === "crop" || state.activeTool === "draw") {
      dom.transformBox.classList.add("hidden");
      return;
    }

    dom.transformBox.classList.remove("hidden");
    dom.transformBox.style.left = `${layer.x}px`;
    dom.transformBox.style.top = `${layer.y}px`;
    dom.transformBox.style.width = `${layer.width}px`;
    dom.transformBox.style.height = `${layer.height}px`;
    if (layer.rotation) {
      dom.transformBox.style.transform = `rotate(${layer.rotation}deg)`;
    } else {
      dom.transformBox.style.transform = "none";
    }

    syncSelectedLayerProps(layer);
  }

  function syncSelectedLayerProps(layer) {
    if (!layer) return;
    if (dom.propLayerName) dom.propLayerName.value = layer.name || "Layer";
    if (dom.propPosX) dom.propPosX.value = Math.round(layer.x);
    if (dom.propPosY) dom.propPosY.value = Math.round(layer.y);
    if (dom.propOpacity) dom.propOpacity.value = Math.round((layer.opacity ?? 1) * 100);
    if (dom.propOpacityVal) dom.propOpacityVal.value = Math.round((layer.opacity ?? 1) * 100);

    if (layer.type === "text" && dom.textLayerInput) {
      dom.textLayerInput.value = layer.text || "";
      if (dom.textSizeInput) dom.textSizeInput.value = layer.fontSize || 48;
      if (dom.textColorInput) dom.textColorInput.value = layer.color || "#FFFFFF";
    }
  }

  function getSelectedLayer() {
    return state.doc.layers.find((l) => l.id === state.selectedLayerId) || null;
  }

  // --- Crop Box Controls ---
  function initCropBox() {
    state.crop.active = true;
    state.crop.x = Math.round(state.doc.width * 0.05);
    state.crop.y = Math.round(state.doc.height * 0.05);
    state.crop.w = Math.round(state.doc.width * 0.9);
    state.crop.h = Math.round(state.doc.height * 0.9);
    dom.cropOverlay.classList.remove("hidden");
    dom.transformBox.classList.add("hidden");
    updateCropBoxDom();
  }

  function updateCropBoxDom() {
    dom.cropBox.style.left = `${state.crop.x}px`;
    dom.cropBox.style.top = `${state.crop.y}px`;
    dom.cropBox.style.width = `${state.crop.w}px`;
    dom.cropBox.style.height = `${state.crop.h}px`;
    if (dom.cropWidthInput) dom.cropWidthInput.value = state.crop.w;
    if (dom.cropHeightInput) dom.cropHeightInput.value = state.crop.h;
  }

  function applyCrop() {
    if (!state.crop.active) return;
    const { x, y, w, h } = state.crop;
    if (w <= 10 || h <= 10) return;

    pushHistory("Crop Canvas");

    // Create cropped canvas buffer for base layer
    state.doc.layers.forEach((l) => {
      l.x -= x;
      l.y -= y;
    });

    state.doc.width = w;
    state.doc.height = h;
    state.crop.active = false;
    dom.cropOverlay.classList.add("hidden");

    updateDimPill();
    fitCanvasToViewport();
    requestRender();
    showToast(`Canvas cropped to ${w}×${h}px`);
  }

  function cancelCrop() {
    state.crop.active = false;
    dom.cropOverlay.classList.add("hidden");
    requestRender();
  }

  // --- Resize Execution ---
  function applyResize(newW, newH) {
    if (!newW || !newH || newW < 16 || newH < 16) return;
    pushHistory(`Resize Canvas to ${newW}×${newH}`);

    const scaleX = newW / state.doc.width;
    const scaleY = newH / state.doc.height;

    state.doc.layers.forEach((l) => {
      l.x = Math.round(l.x * scaleX);
      l.y = Math.round(l.y * scaleY);
      l.width = Math.round(l.width * scaleX);
      l.height = Math.round(l.height * scaleY);
    });

    state.doc.width = newW;
    state.doc.height = newH;
    updateDimPill();
    fitCanvasToViewport();
    requestRender();
    showToast(`Resized to ${newW}×${newH}px`);
  }

  // --- Tool Palette Switching ---
  function setActiveTool(tool) {
    state.activeTool = tool;

    // Update tool icon buttons active state
    dom.toolButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tool === tool);
    });

    // Update Subpanel visibility
    Object.keys(dom.subpanels).forEach((key) => {
      const panel = dom.subpanels[key];
      if (panel) {
        panel.classList.toggle("hidden", key !== tool);
      }
    });

    // Handle tool-specific activations
    if (tool === "crop") {
      initCropBox();
    } else {
      if (state.crop.active) cancelCrop();
    }

    if (tool === "draw") {
      dom.viewport.classList.add("crosshair");
    } else {
      dom.viewport.classList.remove("crosshair");
    }

    requestRender();
  }

  // --- History & Undo / Redo Stack ---
  function pushHistory(actionName = "Edit") {
    // Truncate any future redo states
    if (state.historyIndex < state.history.length - 1) {
      state.history = state.history.slice(0, state.historyIndex + 1);
    }

    // Save lightweight serializable document snapshot
    const snapshot = {
      actionName,
      doc: serializeDocState(state.doc)
    };

    state.history.push(snapshot);
    if (state.history.length > 30) state.history.shift();
    state.historyIndex = state.history.length - 1;

    updateHistoryUi();
  }

  function undo() {
    if (state.historyIndex <= 0) return;
    state.historyIndex--;
    restoreDocSnapshot(state.history[state.historyIndex]);
    updateHistoryUi();
    showToast(`Undone: ${state.history[state.historyIndex + 1].actionName}`);
  }

  function redo() {
    if (state.historyIndex >= state.history.length - 1) return;
    state.historyIndex++;
    restoreDocSnapshot(state.history[state.historyIndex]);
    updateHistoryUi();
    showToast(`Redone: ${state.history[state.historyIndex].actionName}`);
  }

  function serializeDocState(doc) {
    return JSON.stringify({
      width: doc.width,
      height: doc.height,
      name: doc.name,
      backgroundType: doc.backgroundType,
      bgColorVal: doc.bgColorVal,
      transform: { ...doc.transform },
      adjustments: { ...doc.adjustments },
      filter: doc.filter,
      filterIntensity: doc.filterIntensity,
      layers: doc.layers.map((l) => ({
        id: l.id,
        name: l.name,
        type: l.type,
        visible: l.visible,
        locked: l.locked,
        opacity: l.opacity,
        x: l.x,
        y: l.y,
        width: l.width,
        height: l.height,
        rotation: l.rotation,
        scaleX: l.scaleX,
        scaleY: l.scaleY,
        shapeType: l.shapeType,
        fillColor: l.fillColor,
        strokeColor: l.strokeColor,
        strokeWidth: l.strokeWidth,
        text: l.text,
        fontSize: l.fontSize,
        fontFamily: l.fontFamily,
        color: l.color,
        textAlign: l.textAlign,
        fontWeight: l.fontWeight,
        fontStyle: l.fontStyle,
        strokes: l.strokes ? JSON.parse(JSON.stringify(l.strokes)) : null
      }))
    });
  }

  function restoreDocSnapshot(snapshot) {
    if (!snapshot) return;
    const parsed = JSON.parse(snapshot.doc);
    state.doc.width = parsed.width;
    state.doc.height = parsed.height;
    state.doc.name = parsed.name;
    state.doc.backgroundType = parsed.backgroundType;
    state.doc.bgColorVal = parsed.bgColorVal;
    state.doc.transform = parsed.transform;
    state.doc.adjustments = parsed.adjustments;
    state.doc.filter = parsed.filter;
    state.doc.filterIntensity = parsed.filterIntensity;

    // Preserve image sources
    const existingLayersMap = new Map(state.doc.layers.map((l) => [l.id, l]));
    state.doc.layers = parsed.layers.map((l) => {
      const exist = existingLayersMap.get(l.id);
      return {
        ...l,
        source: exist?.source || null,
        originalSource: exist?.originalSource || null
      };
    });

    updateDimPill();
    syncAdjustmentSlidersUi();
    renderLayersList();
    requestRender();
  }

  function updateHistoryUi() {
    dom.undoBtn.disabled = state.historyIndex <= 0;
    dom.redoBtn.disabled = state.historyIndex >= state.history.length - 1;

    if (!dom.historyStackList) return;
    dom.historyStackList.innerHTML = state.history
      .map((item, index) => {
        const isCur = index === state.historyIndex;
        const isUndone = index > state.historyIndex;
        return `
          <div class="history-stack-item${isCur ? " current" : ""}${isUndone ? " undone" : ""}" data-history-idx="${index}">
            <svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="6"></circle></svg>
            <span>${escapeHtml(item.actionName)}</span>
          </div>
        `;
      })
      .reverse()
      .join("");
  }

  // --- Adjustments Sliders & Numeric Inputs Sync ---
  function resetAdjustmentsState() {
    state.doc.adjustments = {
      brightness: 100,
      contrast: 100,
      exposure: 0,
      saturation: 100,
      temperature: 0,
      tint: 0,
      sharpness: 0,
      blur: 0,
      vignette: 0
    };
    state.doc.filter = "none";
    state.doc.filterIntensity = 100;
    syncAdjustmentSlidersUi();
  }

  function syncAdjustmentSlidersUi() {
    const adj = state.doc.adjustments;
    Object.keys(dom.adjInputs).forEach((key) => {
      const item = dom.adjInputs[key];
      const val = adj[key] ?? 0;
      if (item.range) item.range.value = val;
      if (item.num) item.num.value = val;
    });

    if (dom.filterIntensityRange) dom.filterIntensityRange.value = state.doc.filterIntensity;
    if (dom.filterIntensityVal) dom.filterIntensityVal.value = state.doc.filterIntensity;

    dom.filterCards.forEach((card) => {
      card.classList.toggle("active", card.dataset.filter === state.doc.filter);
    });
  }

  // --- Layer Management ---
  function addTextLayer() {
    const textLayer = {
      id: makeId(),
      name: "Text Overlay",
      type: "text",
      visible: true,
      locked: false,
      opacity: 1,
      x: Math.round(state.doc.width * 0.2),
      y: Math.round(state.doc.height * 0.4),
      width: 400,
      height: 120,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      text: dom.textLayerInput?.value || "Heading Title",
      fontSize: Number(dom.textSizeInput?.value) || 48,
      fontFamily: dom.textFontSelect?.value || "Inter, sans-serif",
      color: dom.textColorInput?.value || "#FFFFFF",
      textAlign: "left",
      fontWeight: 700,
      shadow: { enabled: true, color: "rgba(0,0,0,0.6)", blur: 6, offsetX: 2, offsetY: 2 }
    };

    pushHistory("Add Text Layer");
    state.doc.layers.push(textLayer);
    state.selectedLayerId = textLayer.id;
    setActiveTool("select");
    renderLayersList();
    requestRender();
    showToast("Text layer added.");
  }

  function addShapeLayer(shapeType) {
    const shapeLayer = {
      id: makeId(),
      name: `${shapeType.charAt(0).toUpperCase() + shapeType.slice(1)} Shape`,
      type: "shape",
      shapeType,
      visible: true,
      locked: false,
      opacity: 1,
      x: Math.round(state.doc.width * 0.3),
      y: Math.round(state.doc.height * 0.3),
      width: shapeType === "arrow" ? 240 : 180,
      height: shapeType === "arrow" ? 80 : 180,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      fillColor: dom.shapeFillColor?.value || "#2563EB",
      strokeColor: dom.shapeStrokeColor?.value || "#FFFFFF",
      strokeWidth: Number(dom.shapeStrokeWidth?.value) || 2
    };

    pushHistory(`Add ${shapeType} Shape`);
    state.doc.layers.push(shapeLayer);
    state.selectedLayerId = shapeLayer.id;
    setActiveTool("select");
    renderLayersList();
    requestRender();
    showToast(`${shapeLayer.name} added.`);
  }

  function addWatermarkLayer() {
    const text = dom.watermarkTextInput?.value || "© FluxWebP Pro";
    const opacity = (Number(dom.watermarkOpacityRange?.value) || 70) / 100;
    const w = 320;
    const h = 60;
    const margin = 30;

    let x = state.doc.width - w - margin;
    let y = state.doc.height - h - margin;

    const watermarkLayer = {
      id: makeId(),
      name: "Watermark",
      type: "watermark",
      visible: true,
      locked: false,
      opacity,
      x,
      y,
      width: w,
      height: h,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      text,
      fontSize: 28
    };

    pushHistory("Add Watermark");
    state.doc.layers.push(watermarkLayer);
    state.selectedLayerId = watermarkLayer.id;
    renderLayersList();
    requestRender();
    showToast("Watermark layer added.");
  }

  function deleteSelectedLayer() {
    if (!state.selectedLayerId) return;
    if (state.selectedLayerId === "layer_base") {
      showToast("Cannot delete base image layer.");
      return;
    }
    pushHistory("Delete Layer");
    state.doc.layers = state.doc.layers.filter((l) => l.id !== state.selectedLayerId);
    state.selectedLayerId = state.doc.layers[state.doc.layers.length - 1]?.id || null;
    renderLayersList();
    requestRender();
  }

  function duplicateSelectedLayer() {
    const layer = getSelectedLayer();
    if (!layer) return;
    pushHistory(`Duplicate ${layer.name}`);
    const clone = JSON.parse(JSON.stringify(layer));
    clone.id = makeId();
    clone.name = `${layer.name} (Copy)`;
    clone.x += 30;
    clone.y += 30;
    if (layer.source) clone.source = layer.source;

    state.doc.layers.push(clone);
    state.selectedLayerId = clone.id;
    renderLayersList();
    requestRender();
  }

  function renderLayersList() {
    if (!dom.layersList) return;
    dom.layerCountBadge.textContent = String(state.doc.layers.length);

    dom.layersList.innerHTML = state.doc.layers
      .map((layer) => {
        const isSel = layer.id === state.selectedLayerId;
        const iconSvg =
          layer.type === "text"
            ? '<svg viewBox="0 0 24 24" class="layer-type-icon"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="12" y1="4" x2="12" y2="20"></line></svg>'
            : layer.type === "shape"
            ? '<svg viewBox="0 0 24 24" class="layer-type-icon"><rect x="3" y="3" width="18" height="18" rx="2"></rect></svg>'
            : '<svg viewBox="0 0 24 24" class="layer-type-icon"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>';

        return `
          <div class="layer-item${isSel ? " active" : ""}" data-layer-id="${layer.id}">
            <div class="layer-info-group">
              ${iconSvg}
              <span class="layer-name">${escapeHtml(layer.name)}</span>
            </div>
            <div class="layer-actions-group">
              <button class="layer-action-btn" data-action="toggle-visibility" title="Toggle visibility">
                ${
                  layer.visible
                    ? '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>'
                    : '<svg viewBox="0 0 24 24" width="14" height="14" class="active-dim"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path></svg>'
                }
              </button>
              <button class="layer-action-btn" data-action="toggle-lock" title="Lock layer">
                ${
                  layer.locked
                    ? '<svg viewBox="0 0 24 24" width="14" height="14"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>'
                    : '<svg viewBox="0 0 24 24" width="14" height="14" class="active-dim"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>'
                }
              </button>
            </div>
          </div>
        `;
      })
      .reverse()
      .join("");
  }

  // --- Export Pipeline & Conversion Integration ---
  async function generateExportBlob() {
    const { width, height } = state.doc;
    const format = dom.exportFormatSelect?.value || "webp";
    const quality = (Number(dom.exportQualityRange?.value) || 85) / 100;
    const targetKb = Number(dom.exportTargetSize?.value) || 0;

    const exportCanvas = "OffscreenCanvas" in window
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement("canvas"), { width, height });

    const eCtx = exportCanvas.getContext("2d", { alpha: true });

    // Render clean composition onto export canvas
    // 1. Background
    if (state.doc.backgroundType === "color") {
      eCtx.fillStyle = state.doc.bgColorVal || "#FFFFFF";
      eCtx.fillRect(0, 0, width, height);
    } else if (format === "jpeg") {
      // JPEG does not support alpha channel — fallback to studio white
      eCtx.fillStyle = "#FFFFFF";
      eCtx.fillRect(0, 0, width, height);
    }

    // 2. Global Transform
    eCtx.translate(width / 2, height / 2);
    if (state.doc.transform.rotation !== 0) {
      eCtx.rotate((state.doc.transform.rotation * Math.PI) / 180);
    }
    if (state.doc.transform.flipH || state.doc.transform.flipV) {
      eCtx.scale(state.doc.transform.flipH ? -1 : 1, state.doc.transform.flipV ? -1 : 1);
    }
    eCtx.translate(-width / 2, -height / 2);

    // 3. Render Layers
    state.doc.layers.forEach((layer) => {
      if (!layer.visible) return;
      eCtx.save();
      eCtx.globalAlpha = Number(layer.opacity ?? 1);

      const cx = layer.x + layer.width / 2;
      const cy = layer.y + layer.height / 2;
      eCtx.translate(cx, cy);
      if (layer.rotation) eCtx.rotate((layer.rotation * Math.PI) / 180);
      if (layer.scaleX !== 1 || layer.scaleY !== 1) eCtx.scale(layer.scaleX || 1, layer.scaleY || 1);
      eCtx.translate(-layer.width / 2, -layer.height / 2);

      if (layer.type === "image" && layer.source) {
        if (layer.bgType && layer.bgType !== "transparent") {
          eCtx.save();
          if (layer.bgType === "white") {
            eCtx.fillStyle = "#FFFFFF";
            eCtx.fillRect(0, 0, layer.width, layer.height);
          } else if (layer.bgType === "black") {
            eCtx.fillStyle = "#000000";
            eCtx.fillRect(0, 0, layer.width, layer.height);
          } else if (layer.bgType === "color") {
            eCtx.fillStyle = layer.bgColor || "#FFFFFF";
            eCtx.fillRect(0, 0, layer.width, layer.height);
          } else if (layer.bgType === "gradient") {
            const colors = window.FluxBgRemover?.getGradientPresets()?.[layer.bgGradient || "studio-soft"] || ["#E2E8F0", "#CBD5E1"];
            const grad = eCtx.createLinearGradient(0, 0, 0, layer.height);
            grad.addColorStop(0, colors[0]);
            grad.addColorStop(1, colors[1]);
            eCtx.fillStyle = grad;
            eCtx.fillRect(0, 0, layer.width, layer.height);
          } else if (layer.bgType === "custom_image" && layer.bgCustomImage) {
            eCtx.drawImage(layer.bgCustomImage, 0, 0, layer.width, layer.height);
          }
          eCtx.restore();
        }

        const filterStr = buildCssFilterString(state.doc.adjustments, state.doc.filter, state.doc.filterIntensity);
        if (filterStr) eCtx.filter = filterStr;
        eCtx.drawImage(layer.source, 0, 0, layer.width, layer.height);
      } else if (layer.type === "text") {
        eCtx.font = `${layer.fontStyle || "normal"} ${layer.fontWeight || 400} ${layer.fontSize || 48}px ${layer.fontFamily || "Inter, sans-serif"}`;
        eCtx.textAlign = layer.textAlign || "left";
        eCtx.textBaseline = "top";
        eCtx.fillStyle = layer.color || "#FFFFFF";
        (layer.text || "").split("\n").forEach((line, i) => {
          let xPos = layer.textAlign === "center" ? layer.width / 2 : layer.textAlign === "right" ? layer.width : 0;
          eCtx.fillText(line, xPos, i * (layer.fontSize * 1.2));
        });
      } else if (layer.type === "shape") {
        eCtx.fillStyle = layer.fillColor || "#2563EB";
        eCtx.strokeStyle = layer.strokeColor || "#FFFFFF";
        eCtx.lineWidth = Number(layer.strokeWidth || 0);
        eCtx.beginPath();
        if (layer.shapeType === "circle" || layer.shapeType === "ellipse") {
          eCtx.ellipse(layer.width / 2, layer.height / 2, Math.abs(layer.width / 2), Math.abs(layer.height / 2), 0, 0, Math.PI * 2);
        } else {
          eCtx.rect(0, 0, layer.width, layer.height);
        }
        if (layer.fillColor !== "transparent") eCtx.fill();
        if (layer.strokeWidth > 0) eCtx.stroke();
      } else if (layer.type === "watermark") {
        eCtx.font = `600 ${layer.fontSize || 32}px Inter, sans-serif`;
        eCtx.fillStyle = "#FFFFFF";
        eCtx.fillText(layer.text || "© FluxWebP Pro", 10, layer.height / 2);
      }

      eCtx.restore();
    });

    let mime = "image/webp";
    if (format === "png") mime = "image/png";
    if (format === "jpeg") mime = "image/jpeg";
    if (format === "avif") mime = "image/avif";

    let blob;
    if ("convertToBlob" in exportCanvas) {
      blob = await exportCanvas.convertToBlob({ type: mime, quality });
    } else {
      blob = await new Promise((res) => exportCanvas.toBlob(res, mime, quality));
    }

    // Binary search target size constraint if requested
    if (targetKb > 0 && blob.size > targetKb * 1024 && format !== "png") {
      let low = 0.05;
      let high = quality;
      for (let i = 0; i < 5; i++) {
        const q = (low + high) / 2;
        const candidate = "convertToBlob" in exportCanvas
          ? await exportCanvas.convertToBlob({ type: mime, quality: q })
          : await new Promise((res) => exportCanvas.toBlob(res, mime, q));
        if (candidate.size <= targetKb * 1024) {
          blob = candidate;
          low = q;
        } else {
          high = q;
        }
      }
    }

    return { blob, format, width, height };
  }

  async function executeExportDownload() {
    showToast("Compiling high-resolution export...");
    try {
      const { blob, format } = await generateExportBlob();
      const baseName = dom.exportFilenameInput?.value.trim() || state.doc.name || "flux-photo";
      const filename = `${baseName}.${format}`;

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 5000);

      showToast(`Exported ${filename} (${(blob.size / 1024).toFixed(1)} KB)`);
    } catch (err) {
      showToast(`Export error: ${err.message}`);
    }
  }

  // --- Send to Batch Converter Integration ---
  async function sendToConverter() {
    showToast("Preparing image for Converter Queue...");
    try {
      const { blob, format } = await generateExportBlob();
      const filename = `${state.doc.name || "edited-photo"}.${format}`;
      
      // Store in indexedDB or pass via sessionStorage
      const reader = new FileReader();
      reader.onload = () => {
        sessionStorage.setItem("fluxwebp_transfer_image", JSON.stringify({
          name: filename,
          dataUrl: reader.result,
          size: blob.size,
          width: state.doc.width,
          height: state.doc.height
        }));
        window.location.href = "/#/converter";
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      showToast(`Transfer error: ${err.message}`);
    }
  }

  // ========================================================
  // AI BACKGROUND REMOVER & REFINEMENT STUDIO CONTROLLER
  // ========================================================

  const refineSession = {
    isOpen: false,
    activeTool: "restore", // "restore" | "erase"
    brushSize: 32,
    brushHardness: 0.7,
    brushOpacity: 1.0,
    feather: 0,
    viewMode: "cutout", // "cutout" | "ruby" | "matte" | "backdrop" | "split"
    zoom: 1.0,
    isPainting: false,
    lastX: 0,
    lastY: 0,
    sourceCanvas: null,
    workingMaskCanvas: null,
    initialMaskSnapshot: null,
    history: [],
    historyIndex: -1
  };

  let batchItems = [];

  function getActiveLayer() {
    return getSelectedLayer();
  }

  function initBgRemoverSubpanel() {
    // Populate studio gradient pills
    if (dom.gradientPresetPills && window.FluxBgRemover) {
      const presets = window.FluxBgRemover.getGradientPresets();
      dom.gradientPresetPills.innerHTML = Object.keys(presets).map((key) => {
        const colors = presets[key];
        return `<button class="gradient-pill" data-gradient="${key}" title="${key}" style="background:linear-gradient(135deg, ${colors[0]}, ${colors[1]});" type="button"></button>`;
      }).join("");

      dom.gradientPresetPills.addEventListener("click", (e) => {
        const pill = e.target.closest(".gradient-pill");
        if (!pill) return;
        dom.gradientPresetPills.querySelectorAll(".gradient-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        applyBackgroundReplacement("gradient", { gradient: pill.dataset.gradient });
      });
    }

    // Engine select change
    dom.bgRemoverEngineSelect?.addEventListener("change", (e) => {
      const eng = e.target.value;
      if (dom.engineDescText) {
        if (eng === "rmbg") {
          dom.engineDescText.textContent = "Deep neural foreground extraction running 100% locally in browser (WebGPU/WASM).";
        } else if (eng === "fast") {
          dom.engineDescText.textContent = "Instant local color clustering & border matting. 0 MB download, works instantly on all devices.";
        } else {
          dom.engineDescText.textContent = "Connect to self-hosted Rembg / BiRefNet endpoint. Image is sent securely with explicit consent.";
        }
      }
    });

    // Background replacement buttons
    dom.bgOptBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        dom.bgOptBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const type = btn.dataset.bgType;

        dom.replaceGradientGroup?.classList.toggle("hidden", type !== "gradient");
        dom.replaceCustomImageGroup?.classList.toggle("hidden", type !== "custom_image");

        if (type === "transparent" || type === "white" || type === "black") {
          applyBackgroundReplacement(type);
        } else if (type === "color") {
          applyBackgroundReplacement("color", { color: dom.replaceBgColorInput?.value || "#3B82F6" });
        } else if (type === "gradient") {
          applyBackgroundReplacement("gradient", { gradient: "studio-soft" });
        }
      });
    });

    dom.replaceBgColorInput?.addEventListener("input", (e) => {
      applyBackgroundReplacement("color", { color: e.target.value });
    });

    dom.replaceCustomImageFile?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const img = new Image();
      img.onload = () => {
        applyBackgroundReplacement("custom_image", { customImage: img });
      };
      img.src = URL.createObjectURL(file);
    });
  }

  function applyBackgroundReplacement(type, opts = {}) {
    const activeLayer = getActiveLayer();
    if (!activeLayer) return;

    activeLayer.bgType = type;
    if (type === "color") activeLayer.bgColor = opts.color || "#FFFFFF";
    if (type === "gradient") activeLayer.bgGradient = opts.gradient || "studio-soft";
    if (type === "custom_image") activeLayer.bgCustomImage = opts.customImage;

    pushHistory("Change Background Replacement");
    requestRender();
  }

  async function triggerAiBackgroundRemoval() {
    const activeLayer = getActiveLayer();
    if (!activeLayer || activeLayer.type !== "image") {
      showToast("Please select an image layer first.");
      return;
    }

    const source = activeLayer.originalSource || activeLayer.source;
    if (!source) {
      showToast("Selected layer does not contain an image.");
      return;
    }

    const srcCanvas = document.createElement("canvas");
    srcCanvas.width = source.naturalWidth || source.width;
    srcCanvas.height = source.naturalHeight || source.height;
    srcCanvas.getContext("2d").drawImage(source, 0, 0);

    const engine = dom.bgRemoverEngineSelect?.value || "rmbg";
    dom.bgRemovalProgressWrap?.classList.remove("hidden");
    if (dom.btnRunBgRemoval) dom.btnRunBgRemoval.disabled = true;

    try {
      const result = await window.FluxBgRemover.removeBackground(srcCanvas, {
        engine,
        onProgress: (p) => {
          if (dom.bgRemovalStatusText) dom.bgRemovalStatusText.textContent = p.message || "Processing...";
          if (dom.bgRemovalProgressBar && typeof p.progress === "number") {
            dom.bgRemovalProgressBar.style.setProperty("--progress", `${p.progress}%`);
          }
        }
      });

      if (!activeLayer.originalSource) {
        activeLayer.originalSource = source;
      }
      activeLayer.source = result.resultCanvas;
      activeLayer.maskCanvas = result.maskCanvas;
      activeLayer.isCutout = true;

      if (dom.btnOpenRefinementStudio) dom.btnOpenRefinementStudio.disabled = false;
      pushHistory("AI Background Removal");
      requestRender();
      showToast(`AI Cutout complete in ${result.elapsed}s! Click "Open Refinement Studio" to refine.`);
    } catch (err) {
      console.error("AI Background Removal error:", err);
      showToast("AI background removal error: " + err.message);
    } finally {
      dom.bgRemovalProgressWrap?.classList.add("hidden");
      if (dom.btnRunBgRemoval) dom.btnRunBgRemoval.disabled = false;
    }
  }

  function openRefinementStudio() {
    const activeLayer = getActiveLayer();
    if (!activeLayer || !activeLayer.maskCanvas || !activeLayer.originalSource) {
      showToast("Please run background removal before refining edges.");
      return;
    }

    refineSession.isOpen = true;
    refineSession.sourceCanvas = activeLayer.originalSource;
    refineSession.workingMaskCanvas = window.FluxBgRemover.MaskOperations.cloneMask(activeLayer.maskCanvas);
    refineSession.initialMaskSnapshot = window.FluxBgRemover.MaskOperations.cloneMask(activeLayer.maskCanvas);
    refineSession.history = [window.FluxBgRemover.MaskOperations.cloneMask(activeLayer.maskCanvas)];
    refineSession.historyIndex = 0;
    refineSession.zoom = 1.0;

    dom.refinementModal?.showModal();
    setupRefinementCanvas();
    renderRefinementStage();
  }

  function setupRefinementCanvas() {
    const { sourceCanvas } = refineSession;
    if (!sourceCanvas || !dom.refinementCanvas) return;

    dom.refinementCanvas.width = sourceCanvas.width;
    dom.refinementCanvas.height = sourceCanvas.height;
  }

  function renderRefinementStage() {
    const { sourceCanvas, workingMaskCanvas, viewMode } = refineSession;
    if (!sourceCanvas || !workingMaskCanvas || !dom.refinementCanvas) return;

    const rCtx = dom.refinementCanvas.getContext("2d");
    const w = dom.refinementCanvas.width;
    const h = dom.refinementCanvas.height;
    rCtx.clearRect(0, 0, w, h);

    if (viewMode === "cutout") {
      const cutout = window.FluxBgRemover.applyMaskToSource(sourceCanvas, workingMaskCanvas);
      rCtx.drawImage(cutout, 0, 0);
    } else if (viewMode === "ruby") {
      rCtx.drawImage(sourceCanvas, 0, 0);
      rCtx.save();
      const inv = window.FluxBgRemover.MaskOperations.cloneMask(workingMaskCanvas);
      window.FluxBgRemover.MaskOperations.invertMask(inv);
      rCtx.globalCompositeOperation = "source-over";
      rCtx.globalAlpha = 0.5;
      rCtx.fillStyle = "#EF4444";
      rCtx.fillRect(0, 0, w, h);
      rCtx.globalCompositeOperation = "destination-in";
      rCtx.drawImage(inv, 0, 0);
      rCtx.restore();
    } else if (viewMode === "matte") {
      rCtx.drawImage(workingMaskCanvas, 0, 0);
    } else if (viewMode === "backdrop") {
      const activeLayer = getActiveLayer();
      const bg = window.FluxBgRemover.renderWithBackground(sourceCanvas, workingMaskCanvas, {
        type: activeLayer?.bgType || "white",
        color: activeLayer?.bgColor || "#FFFFFF",
        gradient: activeLayer?.bgGradient || "studio-soft",
        customImage: activeLayer?.bgCustomImage
      });
      rCtx.drawImage(bg, 0, 0);
    } else if (viewMode === "split") {
      rCtx.drawImage(sourceCanvas, 0, 0);
      rCtx.save();
      rCtx.beginPath();
      rCtx.rect(w / 2, 0, w / 2, h);
      rCtx.clip();
      rCtx.clearRect(w / 2, 0, w / 2, h);
      const cutout = window.FluxBgRemover.applyMaskToSource(sourceCanvas, workingMaskCanvas);
      rCtx.drawImage(cutout, 0, 0);
      rCtx.restore();

      rCtx.strokeStyle = "#FFFFFF";
      rCtx.lineWidth = 2;
      rCtx.beginPath();
      rCtx.moveTo(w / 2, 0);
      rCtx.lineTo(w / 2, h);
      rCtx.stroke();
    }

    if (dom.refineUndoBtn) dom.refineUndoBtn.disabled = refineSession.historyIndex <= 0;
    if (dom.refineRedoBtn) dom.refineRedoBtn.disabled = refineSession.historyIndex >= refineSession.history.length - 1;
  }

  function pushRefineHistory() {
    refineSession.history = refineSession.history.slice(0, refineSession.historyIndex + 1);
    refineSession.history.push(window.FluxBgRemover.MaskOperations.cloneMask(refineSession.workingMaskCanvas));
    if (refineSession.history.length > 20) refineSession.history.shift();
    refineSession.historyIndex = refineSession.history.length - 1;
  }

  function refineUndo() {
    if (refineSession.historyIndex > 0) {
      refineSession.historyIndex--;
      refineSession.workingMaskCanvas = window.FluxBgRemover.MaskOperations.cloneMask(refineSession.history[refineSession.historyIndex]);
      renderRefinementStage();
    }
  }

  function refineRedo() {
    if (refineSession.historyIndex < refineSession.history.length - 1) {
      refineSession.historyIndex++;
      refineSession.workingMaskCanvas = window.FluxBgRemover.MaskOperations.cloneMask(refineSession.history[refineSession.historyIndex]);
      renderRefinementStage();
    }
  }

  function applyRefinementToLayer() {
    const activeLayer = getActiveLayer();
    if (!activeLayer || !refineSession.workingMaskCanvas || !activeLayer.originalSource) return;

    if (refineSession.feather > 0) {
      window.FluxBgRemover.MaskOperations.applyFeather(refineSession.workingMaskCanvas, refineSession.feather);
    }

    activeLayer.maskCanvas = window.FluxBgRemover.MaskOperations.cloneMask(refineSession.workingMaskCanvas);
    activeLayer.source = window.FluxBgRemover.applyMaskToSource(activeLayer.originalSource, activeLayer.maskCanvas);

    pushHistory("Refine Cutout Mask");
    requestRender();
    dom.refinementModal?.close();
    refineSession.isOpen = false;
    showToast("Refined cutout mask applied to document.");
  }

  function mapPointerToRefineCanvas(e) {
    const rect = dom.refinementCanvas.getBoundingClientRect();
    const scaleX = dom.refinementCanvas.width / rect.width;
    const scaleY = dom.refinementCanvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  function generateSampleCutoutCanvas() {
    const w = 1200;
    const h = 1200;
    const canvas = Object.assign(document.createElement("canvas"), { width: w, height: h });
    const sCtx = canvas.getContext("2d");

    // Vibrant background
    const grad = sCtx.createRadialGradient(w / 2, h / 2, 100, w / 2, h / 2, w * 0.7);
    grad.addColorStop(0, "#F59E0B");
    grad.addColorStop(0.5, "#EF4444");
    grad.addColorStop(1, "#831843");
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, w, h);

    // Subject silhouette & portrait
    sCtx.save();
    sCtx.fillStyle = "#1E293B";
    sCtx.beginPath();
    sCtx.arc(w / 2, h * 0.38, 160, 0, Math.PI * 2);
    sCtx.fill();

    sCtx.beginPath();
    sCtx.arc(w / 2 - 70, h * 0.3, 110, 0, Math.PI * 2);
    sCtx.arc(w / 2 + 70, h * 0.3, 110, 0, Math.PI * 2);
    sCtx.arc(w / 2, h * 0.22, 120, 0, Math.PI * 2);
    sCtx.fill();

    sCtx.fillStyle = "#FDBA74";
    sCtx.beginPath();
    sCtx.arc(w / 2, h * 0.42, 125, 0, Math.PI * 2);
    sCtx.fill();
    sCtx.fillRect(w / 2 - 50, h * 0.5, 100, 120);

    sCtx.fillStyle = "#2563EB";
    sCtx.beginPath();
    sCtx.ellipse(w / 2, h * 0.85, 360, 260, 0, 0, Math.PI * 2);
    sCtx.fill();
    sCtx.restore();

    initDocumentWithImage(canvas, "Portrait Cutout Demo");
    setTimeout(() => {
      setActiveTool("bg-remover");
      triggerAiBackgroundRemoval();
    }, 500);
  }

  function handleBatchFiles(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach((file) => {
      batchItems.push({
        id: makeId(),
        file,
        name: file.name,
        size: file.size,
        status: "queued",
        resultCanvas: null
      });
    });

    renderBatchList();
  }

  function renderBatchList() {
    if (!dom.batchBgItemsList) return;
    if (batchItems.length === 0) {
      dom.batchBgItemsList.innerHTML = `<div class="empty-batch-note">No images queued yet. Upload files above to begin.</div>`;
      return;
    }

    dom.batchBgItemsList.innerHTML = batchItems.map((item) => `
      <div class="batch-item-card" data-batch-id="${item.id}">
        <div class="flex items-center gap-2">
          <strong>${escapeHtml(item.name)}</strong>
          <span class="text-secondary text-xs">(${(item.size / 1024).toFixed(0)} KB)</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="status-pill status-${item.status === 'done' ? 'success' : item.status === 'processing' ? 'active' : 'queued'}">${item.status}</span>
          ${item.resultCanvas ? `<button class="btn btn-xs btn-outline" data-action="download-batch-item" data-id="${item.id}">Download</button>` : ''}
        </div>
      </div>
    `).join("");

    dom.batchBgItemsList.querySelectorAll('button[data-action="download-batch-item"]').forEach((b) => {
      b.addEventListener("click", () => {
        const it = batchItems.find(x => x.id === b.dataset.id);
        if (it && it.resultCanvas) {
          it.resultCanvas.toBlob((blob) => {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `${it.name.replace(/\.[^/.]+$/, "")}-cutout.png`;
            a.click();
          }, "image/png");
        }
      });
    });
  }

  async function startBatchProcessing() {
    const queued = batchItems.filter(i => i.status === "queued");
    if (!queued.length) {
      showToast("No queued images to process.");
      return;
    }

    if (dom.btnStartBatchBg) dom.btnStartBatchBg.disabled = true;
    showToast(`Starting batch background removal for ${queued.length} images...`);

    const sharedBg = dom.batchSharedBgSelect?.value || "transparent";

    await window.FluxBgRemover.runBatchRemoval(queued, {
      concurrency: 2,
      onItemStart: (item) => {
        item.status = "processing";
        renderBatchList();
      },
      onItemDone: (item, res) => {
        item.status = "done";
        if (sharedBg !== "transparent") {
          item.resultCanvas = window.FluxBgRemover.renderWithBackground(res.sourceCanvas, res.maskCanvas, {
            type: sharedBg,
            color: sharedBg === "white" ? "#FFFFFF" : sharedBg === "black" ? "#000000" : "#FFFFFF",
            gradient: "studio-soft"
          });
        } else {
          item.resultCanvas = res.resultCanvas;
        }
        renderBatchList();
      },
      onError: (item) => {
        item.status = "error";
        renderBatchList();
      }
    });

    if (dom.btnStartBatchBg) dom.btnStartBatchBg.disabled = false;
    if (dom.btnDownloadBatchBgZip) dom.btnDownloadBatchBgZip.disabled = false;
    showToast("Batch background removal completed!");
  }

  function bindBgRemoverEvents() {
    initBgRemoverSubpanel();

    // Header & Tool Palette triggers
    dom.btnHeaderRemoveBg?.addEventListener("click", () => {
      setActiveTool("bg-remover");
      triggerAiBackgroundRemoval();
    });

    dom.btnRunBgRemoval?.addEventListener("click", () => {
      triggerAiBackgroundRemoval();
    });

    dom.inspectorRemoveBgBtn?.addEventListener("click", () => {
      setActiveTool("bg-remover");
      triggerAiBackgroundRemoval();
    });

    dom.btnOpenRefinementStudio?.addEventListener("click", openRefinementStudio);

    // Refinement Studio View Tabs
    dom.refineViewTabs?.forEach((tab) => {
      tab.addEventListener("click", () => {
        dom.refineViewTabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        refineSession.viewMode = tab.dataset.view || "cutout";
        renderRefinementStage();
      });
    });

    // Refinement Studio Brush Selectors
    dom.btnBrushRestore?.addEventListener("click", () => {
      refineSession.activeTool = "restore";
      dom.btnBrushRestore.classList.add("active");
      dom.btnBrushErase?.classList.remove("active");
    });

    dom.btnBrushErase?.addEventListener("click", () => {
      refineSession.activeTool = "erase";
      dom.btnBrushErase.classList.add("active");
      dom.btnBrushRestore?.classList.remove("active");
    });

    // Brush parameter sliders
    dom.refineBrushSize?.addEventListener("input", (e) => {
      refineSession.brushSize = Number(e.target.value);
      if (dom.refineBrushSizeVal) dom.refineBrushSizeVal.textContent = `${refineSession.brushSize} px`;
    });

    dom.refineBrushHardness?.addEventListener("input", (e) => {
      refineSession.brushHardness = Number(e.target.value) / 100;
      if (dom.refineBrushHardnessVal) dom.refineBrushHardnessVal.textContent = `${e.target.value}%`;
    });

    dom.refineBrushOpacity?.addEventListener("input", (e) => {
      refineSession.brushOpacity = Number(e.target.value) / 100;
      if (dom.refineBrushOpacityVal) dom.refineBrushOpacityVal.textContent = `${e.target.value}%`;
    });

    dom.refineFeather?.addEventListener("input", (e) => {
      refineSession.feather = Number(e.target.value);
      if (dom.refineFeatherVal) dom.refineFeatherVal.textContent = `${refineSession.feather} px`;
    });

    // Mask operations
    dom.refineInvertMaskBtn?.addEventListener("click", () => {
      if (refineSession.workingMaskCanvas) {
        window.FluxBgRemover.MaskOperations.invertMask(refineSession.workingMaskCanvas);
        pushRefineHistory();
        renderRefinementStage();
      }
    });

    dom.refineResetMaskBtn?.addEventListener("click", () => {
      if (refineSession.initialMaskSnapshot) {
        refineSession.workingMaskCanvas = window.FluxBgRemover.MaskOperations.cloneMask(refineSession.initialMaskSnapshot);
        pushRefineHistory();
        renderRefinementStage();
        showToast("Mask reset to initial AI segmentation.");
      }
    });

    dom.refineRerunAiBtn?.addEventListener("click", async () => {
      if (!refineSession.sourceCanvas) return;
      showToast("Re-running AI segmentation...");
      try {
        const res = await window.FluxBgRemover.removeBackground(refineSession.sourceCanvas, {
          engine: dom.bgRemoverEngineSelect?.value || "rmbg"
        });
        refineSession.workingMaskCanvas = window.FluxBgRemover.MaskOperations.cloneMask(res.maskCanvas);
        refineSession.initialMaskSnapshot = window.FluxBgRemover.MaskOperations.cloneMask(res.maskCanvas);
        pushRefineHistory();
        renderRefinementStage();
        showToast("AI segmentation updated.");
      } catch (err) {
        showToast("Re-run failed: " + err.message);
      }
    });

    dom.refineUndoBtn?.addEventListener("click", refineUndo);
    dom.refineRedoBtn?.addEventListener("click", refineRedo);

    dom.refineApplyBtn?.addEventListener("click", applyRefinementToLayer);
    dom.refineCancelBtn?.addEventListener("click", () => {
      dom.refinementModal?.close();
      refineSession.isOpen = false;
    });

    // Refinement Canvas Drawing Handlers
    dom.refinementStage?.addEventListener("mousemove", (e) => {
      if (dom.brushCursor && dom.refinementCanvas) {
        dom.brushCursor.style.display = "block";
        const rect = dom.refinementStage.getBoundingClientRect();
        dom.brushCursor.style.left = `${e.clientX - rect.left}px`;
        dom.brushCursor.style.top = `${e.clientY - rect.top}px`;
        const canvasRect = dom.refinementCanvas.getBoundingClientRect();
        const displayScale = canvasRect.width / dom.refinementCanvas.width || 1;
        const displayR = Math.max(4, refineSession.brushSize * displayScale);
        dom.brushCursor.style.width = `${displayR * 2}px`;
        dom.brushCursor.style.height = `${displayR * 2}px`;
      }

      if (refineSession.isPainting && refineSession.workingMaskCanvas) {
        const pt = mapPointerToRefineCanvas(e);
        window.FluxBgRemover.MaskOperations.paintStroke(
          refineSession.workingMaskCanvas,
          refineSession.lastX,
          refineSession.lastY,
          pt.x,
          pt.y,
          {
            action: refineSession.activeTool,
            radius: refineSession.brushSize,
            hardness: refineSession.brushHardness,
            opacity: refineSession.brushOpacity
          }
        );
        refineSession.lastX = pt.x;
        refineSession.lastY = pt.y;
        renderRefinementStage();
      }
    });

    dom.refinementStage?.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || !refineSession.workingMaskCanvas) return;
      refineSession.isPainting = true;
      const pt = mapPointerToRefineCanvas(e);
      refineSession.lastX = pt.x;
      refineSession.lastY = pt.y;

      window.FluxBgRemover.MaskOperations.paintBrush(
        refineSession.workingMaskCanvas,
        pt.x,
        pt.y,
        {
          action: refineSession.activeTool,
          radius: refineSession.brushSize,
          hardness: refineSession.brushHardness,
          opacity: refineSession.brushOpacity
        }
      );
      renderRefinementStage();
    });

    window.addEventListener("mouseup", () => {
      if (refineSession.isPainting) {
        refineSession.isPainting = false;
        pushRefineHistory();
      }
    });

    dom.refinementStage?.addEventListener("mouseleave", () => {
      if (dom.brushCursor) dom.brushCursor.style.display = "none";
    });

    // Batch Modal Actions
    dom.btnOpenBatchBgModal?.addEventListener("click", () => {
      dom.batchBgModal?.showModal();
    });

    dom.batchBgUploadTrigger?.addEventListener("click", () => dom.batchBgFileInput?.click());
    dom.batchBgFileInput?.addEventListener("change", handleBatchFiles);

    dom.batchBgDropzone?.addEventListener("dragover", (e) => {
      e.preventDefault();
      dom.batchBgDropzone.classList.add("dragover");
    });
    dom.batchBgDropzone?.addEventListener("dragleave", () => {
      dom.batchBgDropzone.classList.remove("dragover");
    });
    dom.batchBgDropzone?.addEventListener("drop", (e) => {
      e.preventDefault();
      dom.batchBgDropzone.classList.remove("dragover");
      if (e.dataTransfer.files?.length) {
        handleBatchFiles({ target: { files: e.dataTransfer.files } });
      }
    });

    dom.btnStartBatchBg?.addEventListener("click", startBatchProcessing);
    dom.loadSampleCutoutBtn?.addEventListener("click", generateSampleCutoutCanvas);
  }

  // --- Event Bindings ---
  function bindEvents() {
    bindBgRemoverEvents();
    // Theme Toggle
    dom.themeToggleBtn?.addEventListener("click", toggleTheme);

    // Header actions
    dom.undoBtn?.addEventListener("click", undo);
    dom.redoBtn?.addEventListener("click", redo);
    dom.resetAllBtn?.addEventListener("click", () => {
      resetAdjustmentsState();
      state.doc.transform = { rotation: 0, flipH: false, flipV: false };
      pushHistory("Reset All Edits");
      requestRender();
      showToast("All color and geometry edits reset.");
    });

    dom.compareOriginalBtn?.addEventListener("mousedown", () => {
      state.isOriginalComparing = true;
      requestRender();
    });
    dom.compareOriginalBtn?.addEventListener("mouseup", () => {
      state.isOriginalComparing = false;
      requestRender();
    });
    dom.compareOriginalBtn?.addEventListener("mouseleave", () => {
      state.isOriginalComparing = false;
      requestRender();
    });

    dom.projectTitleInput?.addEventListener("change", (e) => {
      state.doc.name = e.target.value.trim() || "Untitled Project";
    });

    dom.openImageBtn?.addEventListener("click", () => dom.fileInput.click());
    dom.landingBrowseBtn?.addEventListener("click", () => dom.fileInput.click());
    dom.fileInput?.addEventListener("change", handleFileInput);

    // Save project (.fluxproj)
    dom.saveProjBtn?.addEventListener("click", () => {
      try {
        const title = state.doc.name || dom.projectTitleInput?.value || "Untitled Edit";
        const key = "fluxwebp_project_" + Date.now();
        const docState = serializeDocState(state.doc);
        const projData = {
          version: "2.4.0",
          type: "fluxproj",
          title,
          date: new Date().toLocaleDateString(),
          doc: docState
        };
        const projJson = JSON.stringify(projData);

        localStorage.setItem(key, JSON.stringify({
          id: key,
          title,
          json: projJson,
          date: new Date().toLocaleDateString()
        }));

        const blob = new Blob([projJson], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}.fluxproj`;
        a.click();
        showToast("Project saved locally and downloaded as .fluxproj!");
      } catch (err) {
        showToast("Failed to save project: " + err.message);
      }
    });

    // Tool switching
    dom.toolButtons.forEach((btn) => {
      btn.addEventListener("click", () => setActiveTool(btn.dataset.tool));
    });

    // Viewport Zoom & Fit
    dom.zoomInBtn?.addEventListener("click", () => setZoom(state.view.zoom * 1.25));
    dom.zoomOutBtn?.addEventListener("click", () => setZoom(state.view.zoom / 1.25));
    dom.zoomFitBtn?.addEventListener("click", fitCanvasToViewport);
    dom.zoomResetBtn?.addEventListener("click", () => setZoom(1.0));

    // Wheel zoom & pan
    dom.viewport?.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY < 0 ? 1.15 : 0.85;
        setZoom(state.view.zoom * factor);
      } else {
        state.view.panX -= e.deltaX * 0.8;
        state.view.panY -= e.deltaY * 0.8;
        updateViewportTransform();
      }
    }, { passive: false });

    // Drag-and-drop file upload
    dom.dropZone?.addEventListener("dragover", (e) => {
      e.preventDefault();
      dom.dropZone.classList.add("dragover");
    });
    dom.dropZone?.addEventListener("dragleave", () => dom.dropZone.classList.remove("dragover"));
    dom.dropZone?.addEventListener("drop", (e) => {
      e.preventDefault();
      dom.dropZone.classList.remove("dragover");
      if (e.dataTransfer.files?.length) {
        handleFile(e.dataTransfer.files[0]);
      }
    });

    // Sample generators
    dom.emptyOverlayCloseBtn?.addEventListener("click", () => dom.emptyOverlay?.classList.add("hidden"));
    dom.loadBlankCanvasBtn?.addEventListener("click", () => initDocumentWithBlank(1920, 1080));
    dom.loadSampleLandscapeBtn?.addEventListener("click", () => generateSampleCanvas("landscape"));
    dom.loadSamplePortraitBtn?.addEventListener("click", () => generateSampleCanvas("portrait"));
    dom.pasteClipboardLandingBtn?.addEventListener("click", pasteFromClipboard);

    // Crop handlers
    dom.applyCropBtn?.addEventListener("click", applyCrop);
    dom.cancelCropBtn?.addEventListener("click", cancelCrop);
    dom.cropAspectBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        dom.cropAspectBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        setCropAspectRatio(btn.dataset.aspect);
      });
    });

    // Resize controls
    dom.applyResizeBtn?.addEventListener("click", () => {
      const w = Number(dom.resizeWInput.value);
      const h = Number(dom.resizeHInput.value);
      applyResize(w, h);
    });
    dom.resizePresetSelect?.addEventListener("change", (e) => {
      if (e.target.value === "custom") return;
      const [w, h] = e.target.value.split("x").map(Number);
      dom.resizeWInput.value = w;
      dom.resizeHInput.value = h;
    });

    // Rotate & Flip buttons
    dom.rotateCcwBtn?.addEventListener("click", () => {
      pushHistory("Rotate 90° CCW");
      state.doc.transform.rotation = (state.doc.transform.rotation - 90) % 360;
      requestRender();
    });
    dom.rotateCwBtn?.addEventListener("click", () => {
      pushHistory("Rotate 90° CW");
      state.doc.transform.rotation = (state.doc.transform.rotation + 90) % 360;
      requestRender();
    });
    dom.flipHorizontalBtn?.addEventListener("click", () => {
      pushHistory("Flip Horizontal");
      state.doc.transform.flipH = !state.doc.transform.flipH;
      requestRender();
    });
    dom.flipVerticalBtn?.addEventListener("click", () => {
      pushHistory("Flip Vertical");
      state.doc.transform.flipV = !state.doc.transform.flipV;
      requestRender();
    });
    dom.freeRotateRange?.addEventListener("input", (e) => {
      dom.freeRotateVal.value = e.target.value;
      state.doc.transform.rotation = Number(e.target.value);
      requestRender();
    });

    // Adjustment sliders binding
    Object.keys(dom.adjInputs).forEach((key) => {
      const item = dom.adjInputs[key];
      const updateVal = (val) => {
        state.doc.adjustments[key] = Number(val);
        if (item.range) item.range.value = val;
        if (item.num) item.num.value = val;
        requestRender();
      };
      item.range?.addEventListener("input", (e) => updateVal(e.target.value));
      item.num?.addEventListener("change", (e) => updateVal(e.target.value));
    });

    dom.resetAdjustmentsBtn?.addEventListener("click", () => {
      resetAdjustmentsState();
      pushHistory("Reset Adjustments");
      requestRender();
    });

    // Filter preset clicks
    dom.filterCards.forEach((card) => {
      card.addEventListener("click", () => {
        dom.filterCards.forEach((c) => c.classList.remove("active"));
        card.classList.add("active");
        state.doc.filter = card.dataset.filter;
        pushHistory(`Apply Filter: ${card.dataset.filter}`);
        requestRender();
      });
    });

    dom.filterIntensityRange?.addEventListener("input", (e) => {
      dom.filterIntensityVal.value = e.target.value;
      state.doc.filterIntensity = Number(e.target.value);
      requestRender();
    });

    // Typography additions
    dom.addTextLayerBtn?.addEventListener("click", addTextLayer);
    dom.textLayerInput?.addEventListener("input", (e) => {
      const layer = getSelectedLayer();
      if (layer && layer.type === "text") {
        layer.text = e.target.value;
        requestRender();
      }
    });

    // Shape insertions
    dom.shapeBtns.forEach((btn) => {
      btn.addEventListener("click", () => addShapeLayer(btn.dataset.shape));
    });

    // Freehand Brush & Eraser
    dom.brushModeBtn?.addEventListener("click", () => {
      state.draw.mode = "brush";
      dom.brushModeBtn.className = "btn btn-sm btn-primary flex-1";
      dom.eraserModeBtn.className = "btn btn-sm btn-outline flex-1";
    });
    dom.eraserModeBtn?.addEventListener("click", () => {
      state.draw.mode = "eraser";
      dom.eraserModeBtn.className = "btn btn-sm btn-primary flex-1";
      dom.brushModeBtn.className = "btn btn-sm btn-outline flex-1";
    });
    dom.brushSizeInput?.addEventListener("input", (e) => {
      state.draw.size = Number(e.target.value);
    });
    dom.brushColorInput?.addEventListener("input", (e) => {
      state.draw.color = e.target.value;
    });
    dom.clearDrawingBtn?.addEventListener("click", () => {
      const drawLayer = state.doc.layers.find((l) => l.type === "drawing");
      if (drawLayer) {
        drawLayer.strokes = [];
        pushHistory("Clear Drawings");
        requestRender();
      }
    });

    // Watermark
    dom.applyWatermarkBtn?.addEventListener("click", addWatermarkLayer);

    // Background selection
    dom.bgTypeSelect?.addEventListener("change", (e) => {
      state.doc.backgroundType = e.target.value;
      dom.bgColorGroup?.classList.toggle("hidden", e.target.value !== "color");
      pushHistory("Change Background");
      requestRender();
    });
    dom.bgColorInput?.addEventListener("input", (e) => {
      state.doc.bgColorVal = e.target.value;
      requestRender();
    });

    // Inspector Tabs
    dom.panelTabBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        dom.panelTabBtns.forEach((b) => {
          b.classList.remove("active");
          b.setAttribute("aria-selected", "false");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");

        Object.keys(dom.tabContents).forEach((tabKey) => {
          const content = dom.tabContents[tabKey];
          content.classList.toggle("active", tabKey === btn.dataset.tab);
        });
      });
    });

    // Layer management actions
    dom.deleteSelectedLayerBtn?.addEventListener("click", deleteSelectedLayer);
    dom.duplicateLayerBtn?.addEventListener("click", duplicateSelectedLayer);
    dom.bringForwardBtn?.addEventListener("click", () => moveLayerOrder(1));
    dom.sendBackwardBtn?.addEventListener("click", () => moveLayerOrder(-1));

    dom.layersList?.addEventListener("click", (e) => {
      const item = e.target.closest(".layer-item");
      if (!item) return;
      const id = item.dataset.layerId;
      const layer = state.doc.layers.find((l) => l.id === id);
      if (!layer) return;

      const actBtn = e.target.closest(".layer-action-btn");
      if (actBtn) {
        if (actBtn.dataset.action === "toggle-visibility") {
          layer.visible = !layer.visible;
        } else if (actBtn.dataset.action === "toggle-lock") {
          layer.locked = !layer.locked;
        }
      } else {
        state.selectedLayerId = id;
      }
      renderLayersList();
      requestRender();
    });

    // Export Triggers
    dom.headerExportBtn?.addEventListener("click", () => {
      // Switch right panel to Export tab
      dom.panelTabBtns.forEach((b) => b.classList.toggle("active", b.dataset.tab === "export"));
      Object.keys(dom.tabContents).forEach((k) => dom.tabContents[k].classList.toggle("active", k === "export"));
      if (window.innerWidth <= 1024) dom.rightPanel.classList.add("open");
    });
    dom.downloadExportedBtn?.addEventListener("click", executeExportDownload);
    dom.openInConverterBtn?.addEventListener("click", sendToConverter);

    // Interactive Canvas Pointer Events (Select, Move, Handles, Draw)
    bindCanvasPointerEvents();

    // Keyboard Shortcuts
    window.addEventListener("keydown", handleKeyboardShortcuts);
  }

  // --- Canvas Pointer Interaction Handling ---
  function bindCanvasPointerEvents() {
    dom.viewport.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  function getCanvasCoords(e) {
    const rect = dom.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (state.doc.width / rect.width);
    const y = (e.clientY - rect.top) * (state.doc.height / rect.height);
    return { x, y };
  }

  function onPointerDown(e) {
    // 1. Freehand Drawing Mode
    if (state.activeTool === "draw") {
      const coords = getCanvasCoords(e);
      let drawLayer = state.doc.layers.find((l) => l.type === "drawing");
      if (!drawLayer) {
        drawLayer = {
          id: makeId(),
          name: "Freehand Drawings",
          type: "drawing",
          visible: true,
          locked: false,
          opacity: 1,
          x: 0,
          y: 0,
          width: state.doc.width,
          height: state.doc.height,
          strokes: []
        };
        state.doc.layers.push(drawLayer);
        renderLayersList();
      }

      state.draw.isDrawing = true;
      state.draw.currentStroke = {
        mode: state.draw.mode,
        size: state.draw.size,
        color: state.draw.color,
        points: [coords]
      };
      drawLayer.strokes.push(state.draw.currentStroke);
      requestRender();
      return;
    }

    // 2. Spacebar or Middle Click Pan
    if (e.spaceKey || e.button === 1) {
      state.view.isPanning = true;
      state.view.panStartX = e.clientX - state.view.panX;
      state.view.panStartY = e.clientY - state.view.panY;
      dom.viewport.classList.add("panning");
      return;
    }

    // 3. Transform Handle Check
    const handleEl = e.target.closest(".handle");
    if (handleEl) {
      state.dragHandle = handleEl.dataset.handle;
      state.dragStartX = e.clientX;
      state.dragStartY = e.clientY;
      const layer = getSelectedLayer();
      if (layer) {
        state.layerStartTransform = { ...layer };
      }
      return;
    }

    // 4. Layer Hit Testing on Canvas
    const coords = getCanvasCoords(e);
    let hitLayer = null;

    for (let i = state.doc.layers.length - 1; i >= 0; i--) {
      const layer = state.doc.layers[i];
      if (!layer.visible || layer.locked) continue;
      if (
        coords.x >= layer.x &&
        coords.x <= layer.x + layer.width &&
        coords.y >= layer.y &&
        coords.y <= layer.y + layer.height
      ) {
        hitLayer = layer;
        break;
      }
    }

    if (hitLayer) {
      state.selectedLayerId = hitLayer.id;
      state.dragHandle = "move";
      state.dragStartX = e.clientX;
      state.dragStartY = e.clientY;
      state.layerStartTransform = { ...hitLayer };
      renderLayersList();
      requestRender();
    }
  }

  function onPointerMove(e) {
    if (state.view.isPanning) {
      state.view.panX = e.clientX - state.view.panStartX;
      state.view.panY = e.clientY - state.view.panStartY;
      updateViewportTransform();
      return;
    }

    if (state.draw.isDrawing && state.draw.currentStroke) {
      const coords = getCanvasCoords(e);
      state.draw.currentStroke.points.push(coords);
      requestRender();
      return;
    }

    if (!state.dragHandle || !state.layerStartTransform) return;
    const layer = getSelectedLayer();
    if (!layer || layer.locked) return;

    const dx = (e.clientX - state.dragStartX) / state.view.zoom;
    const dy = (e.clientY - state.dragStartY) / state.view.zoom;
    const start = state.layerStartTransform;

    if (state.dragHandle === "move") {
      layer.x = Math.round(start.x + dx);
      layer.y = Math.round(start.y + dy);
    } else if (state.dragHandle === "br") {
      layer.width = Math.max(20, Math.round(start.width + dx));
      layer.height = Math.max(20, Math.round(start.height + dy));
    } else if (state.dragHandle === "bl") {
      layer.x = Math.round(start.x + dx);
      layer.width = Math.max(20, Math.round(start.width - dx));
      layer.height = Math.max(20, Math.round(start.height + dy));
    } else if (state.dragHandle === "tr") {
      layer.y = Math.round(start.y + dy);
      layer.width = Math.max(20, Math.round(start.width + dx));
      layer.height = Math.max(20, Math.round(start.height - dy));
    } else if (state.dragHandle === "tl") {
      layer.x = Math.round(start.x + dx);
      layer.y = Math.round(start.y + dy);
      layer.width = Math.max(20, Math.round(start.width - dx));
      layer.height = Math.max(20, Math.round(start.height - dy));
    } else if (state.dragHandle === "rotate") {
      const cx = layer.x + layer.width / 2;
      const cy = layer.y + layer.height / 2;
      const curCoords = getCanvasCoords(e);
      const angle = Math.atan2(curCoords.y - cy, curCoords.x - cx) * (180 / Math.PI) + 90;
      layer.rotation = Math.round(angle);
    }

    requestRender();
  }

  function onPointerUp() {
    if (state.view.isPanning) {
      state.view.isPanning = false;
      dom.viewport.classList.remove("panning");
    }
    if (state.draw.isDrawing) {
      state.draw.isDrawing = false;
      state.draw.currentStroke = null;
      pushHistory("Paint Brush Stroke");
    }
    if (state.dragHandle) {
      pushHistory(`Transform ${getSelectedLayer()?.name || "Layer"}`);
      state.dragHandle = null;
      state.layerStartTransform = null;
    }
  }

  function moveLayerOrder(delta) {
    const idx = state.doc.layers.findIndex((l) => l.id === state.selectedLayerId);
    if (idx === -1) return;
    const targetIdx = idx + delta;
    if (targetIdx < 0 || targetIdx >= state.doc.layers.length) return;

    pushHistory("Reorder Layers");
    const [layer] = state.doc.layers.splice(idx, 1);
    state.doc.layers.splice(targetIdx, 0, layer);
    renderLayersList();
    requestRender();
  }

  function setCropAspectRatio(aspect) {
    state.crop.aspect = aspect;
    const curW = state.crop.w;
    switch (aspect) {
      case "1:1":
        state.crop.h = curW;
        break;
      case "4:3":
        state.crop.h = Math.round((curW * 3) / 4);
        break;
      case "3:2":
        state.crop.h = Math.round((curW * 2) / 3);
        break;
      case "16:9":
        state.crop.h = Math.round((curW * 9) / 16);
        break;
      case "9:16":
        state.crop.h = Math.round((curW * 16) / 9);
        break;
    }
    updateCropBoxDom();
  }

  // --- Keyboard Shortcuts Manager ---
  function handleKeyboardShortcuts(e) {
    // Avoid intercepting while typing in form inputs
    if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;

    const isCtrl = e.ctrlKey || e.metaKey;

    if (isCtrl && e.key === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if (isCtrl && (e.key === "y" || (e.shiftKey && e.key === "Z"))) {
      e.preventDefault();
      redo();
    } else if (isCtrl && e.key === "s") {
      e.preventDefault();
      executeProjectSave();
    } else if (isCtrl && e.key === "d") {
      e.preventDefault();
      duplicateSelectedLayer();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      deleteSelectedLayer();
    } else if (isCtrl && e.key === "0") {
      e.preventDefault();
      fitCanvasToViewport();
    } else if (isCtrl && (e.key === "=" || e.key === "+")) {
      e.preventDefault();
      setZoom(state.view.zoom * 1.2);
    } else if (isCtrl && (e.key === "-" || e.key === "_")) {
      e.preventDefault();
      setZoom(state.view.zoom / 1.2);
    } else if (e.key === "Escape") {
      state.selectedLayerId = null;
      if (state.crop.active) cancelCrop();
      requestRender();
    }
  }

  // --- Project Save & Recovery (.fluxproj) ---
  function executeProjectSave() {
    const projectData = {
      version: "2.4.0",
      type: "fluxwebp-project",
      doc: state.doc,
      created: new Date().toISOString()
    };

    const json = JSON.stringify(projectData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${state.doc.name || "flux-project"}.fluxproj`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);

    showToast("Project saved locally as .fluxproj");
  }

  // --- File Upload & Decode Handling ---
  function handleFileInput(e) {
    if (e.target.files?.length) {
      handleFile(e.target.files[0]);
    }
  }

  function handleFile(file) {
    if (!file) return;
    showToast(`Reading ${file.name}...`);

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      initDocumentWithImage(img, file.name);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      showToast("Unable to decode this image format.");
    };
    img.src = url;
  }

  function pasteFromClipboard() {
    if (!navigator.clipboard?.read) {
      showToast("Clipboard reading unsupported in this browser.");
      return;
    }
    navigator.clipboard.read().then((items) => {
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            item.getType(type).then((blob) => {
              const file = new File([blob], "clipboard-image.png", { type });
              handleFile(file);
            });
            return;
          }
        }
      }
      showToast("No image found on clipboard.");
    }).catch(() => {
      showToast("Clipboard permission denied.");
    });
  }

  // --- Synthetic Sample Image Generator ---
  function initDocumentWithBlank(w = 1920, h = 1080) {
    const blankCanvas = Object.assign(document.createElement("canvas"), { width: w, height: h });
    const bCtx = blankCanvas.getContext("2d");
    bCtx.fillStyle = "#FFFFFF";
    bCtx.fillRect(0, 0, w, h);
    initDocumentWithImage(blankCanvas, "Blank Canvas");
    dom.emptyOverlay?.classList.add("hidden");
  }

  function generateSampleCanvas(type = "landscape") {
    const isLand = type === "landscape";
    const w = isLand ? 1920 : 1080;
    const h = isLand ? 1080 : 1920;

    const sampleCanvas = Object.assign(document.createElement("canvas"), { width: w, height: h });
    const sCtx = sampleCanvas.getContext("2d");

    // Sky gradient
    const skyGrad = sCtx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, "#1E3A8A");
    skyGrad.addColorStop(0.5, "#3B82F6");
    skyGrad.addColorStop(0.85, "#F97316");
    skyGrad.addColorStop(1, "#FDE047");
    sCtx.fillStyle = skyGrad;
    sCtx.fillRect(0, 0, w, h);

    // Sun
    sCtx.beginPath();
    sCtx.arc(w * 0.5, h * 0.75, Math.min(w, h) * 0.18, 0, Math.PI * 2);
    sCtx.fillStyle = "rgba(254, 240, 138, 0.9)";
    sCtx.shadowColor = "rgba(251, 146, 60, 0.8)";
    sCtx.shadowBlur = 40;
    sCtx.fill();
    sCtx.shadowBlur = 0;

    // Mountain silhouettes
    sCtx.beginPath();
    sCtx.moveTo(0, h);
    sCtx.lineTo(w * 0.25, h * 0.6);
    sCtx.lineTo(w * 0.55, h * 0.8);
    sCtx.lineTo(w * 0.85, h * 0.55);
    sCtx.lineTo(w, h);
    sCtx.closePath();
    sCtx.fillStyle = "#0F172A";
    sCtx.fill();

    initDocumentWithImage(sampleCanvas, `Sample ${type.charAt(0).toUpperCase() + type.slice(1)}`);
  }

  // --- Initial Check for Transferred Image from Converter ---
  function initEmptyState() {
    try {
      const importedProject = sessionStorage.getItem("fluxwebp_imported_project");
      if (importedProject) {
        sessionStorage.removeItem("fluxwebp_imported_project");
        try {
          const parsedProj = JSON.parse(importedProject);
          const docData = parsedProj.doc ? (typeof parsedProj.doc === 'string' ? JSON.parse(parsedProj.doc) : parsedProj.doc) : parsedProj;
          restoreDocSnapshot({ doc: JSON.stringify(docData) });
          if (dom.projectTitleInput) dom.projectTitleInput.value = docData.name || parsedProj.title || "Imported Project";
          requestRender();
          fitCanvasToViewport();
          dom.emptyOverlay?.classList.add("hidden");
          showToast("Loaded saved project!");
          return;
        } catch (e) {
          console.warn("Could not parse imported project:", e);
        }
      }

      const importedPoster = sessionStorage.getItem("fluxwebp_imported_editor_image");
      const posterTitle = sessionStorage.getItem("fluxwebp_editor_title") || "Poster Design";
      if (importedPoster) {
        sessionStorage.removeItem("fluxwebp_imported_editor_image");
        sessionStorage.removeItem("fluxwebp_editor_title");
        const img = new Image();
        img.onload = () => {
          initDocumentWithImage(img, posterTitle);
          if (dom.projectTitleInput) dom.projectTitleInput.value = posterTitle;
        };
        img.src = importedPoster;
        return;
      }

      const transferred = sessionStorage.getItem("fluxwebp_edit_source");
      const autoRemoveBg = sessionStorage.getItem("fluxwebp_auto_remove_bg") === "true";
      if (transferred) {
        sessionStorage.removeItem("fluxwebp_edit_source");
        sessionStorage.removeItem("fluxwebp_auto_remove_bg");
        const parsed = JSON.parse(transferred);
        if (parsed.dataUrl) {
          const img = new Image();
          img.onload = () => {
            initDocumentWithImage(img, parsed.name || "Imported Image");
            if (autoRemoveBg) {
              setTimeout(() => {
                setActiveTool("bg-remover");
                triggerAiBackgroundRemoval();
              }, 400);
            }
          };
          img.src = parsed.dataUrl;
          return;
        }
      }
    } catch (_) {}

    // Auto-load high-resolution landscape photo sample by default so the editor is immediately interactive
    generateSampleCanvas("landscape");
    dom.emptyOverlay?.classList.add("hidden");
  }

  // --- Utility Functions ---
  function makeId() {
    return `layer_${Math.random().toString(36).slice(2, 9)}`;
  }

  function escapeHtml(val) {
    return String(val)
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
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(8px) scale(0.96)";
      setTimeout(() => toast.remove(), 320);
    }, 3200);
  }

  // Export Global API for developer inspections
  window.FluxEditor = {
    getState: () => state,
    getSelectedLayer,
    getActiveLayer,
    setActiveTool,
    initDocumentWithImage,
    applyCrop,
    applyResize,
    triggerAiBackgroundRemoval,
    openRefinementStudio,
    applyRefinementToLayer,
    generateExportBlob,
    undo,
    redo
  };
})();
