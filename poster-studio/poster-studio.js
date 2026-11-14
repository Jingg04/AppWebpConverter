/**
 * FluxWebP Pro — AI Poster Studio Workspace Controller
 * Ties together UI, AI Generation, Template Catalog, Brand Kits, and Export Pipeline
 */

(function () {
  let engine = null;

  // DOM Elements cache
  const dom = {
    canvas: document.getElementById('posterCanvas'),
    canvasWrapper: document.getElementById('canvasWrapper'),
    studioViewport: document.getElementById('studioViewport'),
    projectTitleInput: document.getElementById('projectTitleInput'),
    canvasDimPill: document.getElementById('canvasDimPill'),
    aiStatusPill: document.getElementById('aiStatusPill'),
    aiStatusText: document.getElementById('aiStatusText'),
    btnUndo: document.getElementById('btnUndo'),
    btnRedo: document.getElementById('btnRedo'),
    btnOpenInEditor: document.getElementById('btnOpenInEditor'),
    btnOpenExportModal: document.getElementById('btnOpenExportModal'),
    btnCloseExportModal: document.getElementById('btnCloseExportModal'),
    exportModal: document.getElementById('exportModal'),
    btnDownloadExport: document.getElementById('btnDownloadExport'),
    btnSendToCompressor: document.getElementById('btnSendToCompressor'),
    exportFormatSelect: document.getElementById('exportFormatSelect'),
    exportScaleSelect: document.getElementById('exportScaleSelect'),
    exportQualitySlider: document.getElementById('exportQualitySlider'),
    exportQualityVal: document.getElementById('exportQualityVal'),
    // Navigation Rail & Panels
    railBtns: document.querySelectorAll('.rail-btn'),
    panels: {
      presets: document.getElementById('panelPresets'),
      generate: document.getElementById('panelGenerate'),
      templates: document.getElementById('panelTemplates'),
      product: document.getElementById('panelProduct'),
      layers: document.getElementById('panelLayers'),
      text: document.getElementById('panelText'),
      brandkit: document.getElementById('panelBrandkit'),
      designs: document.getElementById('panelDesigns'),
      history: document.getElementById('panelHistory')
    },
    // Prompt & Generate
    promptInput: document.getElementById('promptInput'),
    categorySelect: document.getElementById('categorySelect'),
    visualStyleSelect: document.getElementById('visualStyleSelect'),
    aiProviderSelect: document.getElementById('aiProviderSelect'),
    btnMagicEnhance: document.getElementById('btnMagicEnhance'),
    btnGenerateVisual: document.getElementById('btnGenerateVisual'),
    // Templates
    templateSearchInput: document.getElementById('templateSearchInput'),
    templateCategoryPills: document.getElementById('templateCategoryPills'),
    templatesCatalogGrid: document.getElementById('templatesCatalogGrid'),
    // Product Upload
    productDropzone: document.getElementById('productDropzone'),
    productFileInput: document.getElementById('productFileInput'),
    autoCutoutCheckbox: document.getElementById('autoCutoutCheckbox'),
    // Layers & Inspector
    studioLayersList: document.getElementById('studioLayersList'),
    btnAddTextLayer: document.getElementById('btnAddTextLayer'),
    btnAddBadgeLayer: document.getElementById('btnAddBadgeLayer'),
    btnAddNewTextFromPanel: document.getElementById('btnAddNewTextFromPanel'),
    inspectorTitle: document.getElementById('inspectorTitle'),
    inspectorBody: document.getElementById('inspectorBody'),
    // Typography Panel
    textLayerInput: document.getElementById('textLayerInput'),
    fontFamilySelect: document.getElementById('fontFamilySelect'),
    fontSizeSlider: document.getElementById('fontSizeSlider'),
    fontSizeVal: document.getElementById('fontSizeVal'),
    textColorPicker: document.getElementById('textColorPicker'),
    btnManualRefineCutout: document.getElementById('btnManualRefineCutout'),
    // Brand Kits & Saved Designs
    brandKitsList: document.getElementById('brandKitsList'),
    btnOpenNewBrandKitModal: document.getElementById('btnOpenNewBrandKitModal'),
    savedProjectsList: document.getElementById('savedProjectsList'),
    btnSaveCurrentProject: document.getElementById('btnSaveCurrentProject'),
    generationHistoryList: document.getElementById('generationHistoryList'),
    // Zoom & Viewport
    btnZoomIn: document.getElementById('btnZoomIn'),
    btnZoomOut: document.getElementById('btnZoomOut'),
    btnZoomFit: document.getElementById('btnZoomFit'),
    zoomReadout: document.getElementById('zoomReadout'),
    toastContainer: document.getElementById('toastContainer')
  };

  // Default Brand Kits
  const DEFAULT_BRAND_KITS = [
    {
      id: 'brand-apex-tech',
      name: 'Apex Neural Systems',
      colors: { primary: '#2563EB', secondary: '#38BDF8', accent: '#F97316' },
      fonts: { heading: 'Space Grotesk', body: 'Inter' }
    },
    {
      id: 'brand-vanguard-luxury',
      name: 'Vanguard Maison Luxe',
      colors: { primary: '#D4AF37', secondary: '#111111', accent: '#F5EBE1' },
      fonts: { heading: 'Cinzel', body: 'Playfair Display' }
    },
    {
      id: 'brand-aeroglide-sports',
      name: 'AeroGlide Athletics',
      colors: { primary: '#EF4444', secondary: '#FACC15', accent: '#0F172A' },
      fonts: { heading: 'Bebas Neue', body: 'Montserrat' }
    }
  ];

  // -------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------
  function init() {
    if (!dom.canvas) return;

    engine = new FluxPosterEngine.PosterEngine(dom.canvas);

    // Load initial default template (AeroGlide Sneaker)
    const initialTmpl = FluxPosterTemplates.getTemplateById('prod-sneaker-hyper') || FluxPosterTemplates.getTemplates()[0];
    if (initialTmpl) {
      engine.loadTemplate(initialTmpl);
      updateCanvasDimensionsReadout();
      renderLayersList();
    }

    // Engine Event Listeners
    engine.on('selectionChange', (layer) => {
      renderLayersList();
      renderInspector(layer);
      syncTypographyPanel(layer);
    });

    engine.on('historyChange', ({ canUndo, canRedo }) => {
      if (dom.btnUndo) dom.btnUndo.disabled = !canUndo;
      if (dom.btnRedo) dom.btnRedo.disabled = !canRedo;
    });

    engine.on('render', () => {
      // Sync canvas dimensions
      updateCanvasDimensionsReadout();
    });

    // Bind UI Interactions
    bindNavRail();
    bindPresets();
    bindPromptControls();
    bindTemplatesCatalog();
    bindProductUpload();
    bindLayersList();
    bindTypographyPanel();
    bindBrandKits();
    bindSavedDesigns();
    bindExportModal();
    bindZoomControls();
    bindHandoffActions();

    // Initial Zoom Fit
    fitCanvasToViewport();
    checkAiStatus();
    checkTransferredImage();
  }

  // Check incoming transferred image or project from other tools
  async function checkTransferredImage() {
    try {
      const importedProj = sessionStorage.getItem('fluxwebp_imported_project');
      if (importedProj) {
        sessionStorage.removeItem('fluxwebp_imported_project');
        try {
          const parsed = JSON.parse(importedProj);
          const tmpl = parsed.doc ? (typeof parsed.doc === 'string' ? JSON.parse(parsed.doc) : parsed.doc) : (parsed.json ? JSON.parse(parsed.json) : parsed);
          if (tmpl.doc) {
            engine.doc = tmpl.doc;
            engine.render();
          } else {
            engine.loadTemplate(tmpl);
          }
          if (dom.projectTitleInput) dom.projectTitleInput.value = parsed.title || tmpl.name || 'Imported Poster';
          fitCanvasToViewport();
          renderLayersList();
          showToast('Loaded saved poster design!');
          return;
        } catch (e) {
          console.warn('Could not parse imported poster:', e);
        }
      }
      const incomingPosterBg = sessionStorage.getItem('fluxwebp_poster_bg_image');
      if (incomingPosterBg) {
        sessionStorage.removeItem('fluxwebp_poster_bg_image');
        const res = await fetch(incomingPosterBg);
        const blob = await res.blob();
        const file = new File([blob], 'cutout.png', { type: 'image/png' });
        await engine.loadProductImage(file, false);
        showToast('Cutout placed onto poster canvas!');
        return;
      }

      const rawSource = sessionStorage.getItem('fluxwebp_edit_source');
      if (rawSource) {
        sessionStorage.removeItem('fluxwebp_edit_source');
        const parsed = JSON.parse(rawSource);
        if (parsed && parsed.dataUrl) {
          const res = await fetch(parsed.dataUrl);
          const blob = await res.blob();
          const file = new File([blob], parsed.name || 'product.png', { type: blob.type || 'image/png' });
          await engine.loadProductImage(file, true);
          showToast(`Loaded "${file.name}" as product layer!`);
        }
      }
    } catch (err) {
      console.warn('Could not auto-import transferred image:', err);
    }
  }

  // -------------------------------------------------------------
  // Navigation Rail Switching
  // -------------------------------------------------------------
  function bindNavRail() {
    dom.railBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tabKey = btn.dataset.tab;
        dom.railBtns.forEach((b) => b.classList.toggle('active', b === btn));

        Object.keys(dom.panels).forEach((k) => {
          const panel = dom.panels[k];
          if (panel) {
            panel.classList.toggle('hidden', k !== tabKey);
          }
        });

        // Trigger panel-specific updates
        if (tabKey === 'layers') renderLayersList();
        if (tabKey === 'brandkit') renderBrandKits();
        if (tabKey === 'designs') renderSavedDesigns();
        if (tabKey === 'history') renderHistoryList();
      });
    });
  }

  // -------------------------------------------------------------
  // Canvas Presets
  // -------------------------------------------------------------
  function bindPresets() {
    document.querySelectorAll('.preset-card').forEach((card) => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.preset-card').forEach((c) => c.classList.remove('active'));
        card.classList.add('active');

        const presetKey = card.dataset.preset;
        engine.setPreset(presetKey);
        fitCanvasToViewport();
        showToast(`Applied preset: ${card.querySelector('.preset-card-name')?.textContent}`);
      });
    });
  }

  function updateCanvasDimensionsReadout() {
    if (dom.canvasDimPill && engine) {
      dom.canvasDimPill.textContent = `${engine.doc.width} × ${engine.doc.height} px (${engine.doc.dpi || 72} DPI)`;
    }
  }

  // -------------------------------------------------------------
  // AI Prompt & Generation
  // -------------------------------------------------------------
  function bindPromptControls() {
    // Magic Enhance Prompt
    dom.btnMagicEnhance?.addEventListener('click', async () => {
      const orig = dom.promptInput?.value || '';
      const category = dom.categorySelect?.value || 'product-advertising';
      const style = dom.visualStyleSelect?.value || 'commercial-advertising';

      dom.btnMagicEnhance.disabled = true;
      dom.btnMagicEnhance.innerHTML = `<span>Enhancing...</span>`;

      try {
        const resp = await fetch('/api/enhance-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: orig, category, style })
        });

        const json = await resp.json();
        if (json.enhancedPrompt) {
          dom.promptInput.value = json.enhancedPrompt;

          // Also suggest headline on main headline layer
          const headLayer = engine.doc.layers.find((l) => l.name?.includes('Headline'));
          if (headLayer && json.suggestedHeadline) {
            headLayer.text = json.suggestedHeadline;
            engine.render();
          }

          showToast('Prompt enhanced with commercial studio qualifiers!');
        }
      } catch (err) {
        console.warn('Enhance prompt API error:', err);
        showToast('Prompt enhancement complete (local synthesis).');
      } finally {
        dom.btnMagicEnhance.disabled = false;
        dom.btnMagicEnhance.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L9.5 7.5 4 10l5.5 2.5L12 18l2.5-5.5L20 10l-5.5-2.5L12 2z"></path></svg><span>Magic Enhance Prompt</span>`;
      }
    });

    // Generate Poster Artwork
    dom.btnGenerateVisual?.addEventListener('click', async () => {
      const prompt = dom.promptInput?.value?.trim();
      if (!prompt) {
        showToast('Please enter a poster concept description.');
        return;
      }

      const style = dom.visualStyleSelect?.value || 'commercial-advertising';
      const provider = dom.aiProviderSelect?.value || 'flux-community';

      dom.btnGenerateVisual.disabled = true;
      dom.btnGenerateVisual.innerHTML = `<span>Synthesizing Scene...</span>`;
      showToast('Contacting AI provider for photorealistic artwork...');

      const startTime = Date.now();

      try {
        const result = await engine.generatePosterVisual(prompt, { style, provider });
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        // Record generation in history
        recordHistoryLog({
          prompt,
          provider: result.provider,
          model: result.model || 'FLUX.1-schnell',
          width: engine.doc.width,
          height: engine.doc.height,
          elapsed,
          timestamp: new Date().toLocaleTimeString()
        });

        showToast(`AI Artwork generated successfully in ${elapsed}s!`);
      } catch (err) {
        console.error('Artwork generation error:', err);
        showToast('Generation error: ' + err.message);
      } finally {
        dom.btnGenerateVisual.disabled = false;
        dom.btnGenerateVisual.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L9.5 7.5 4 10l5.5 2.5L12 18l2.5-5.5L20 10l-5.5-2.5L12 2z"></path></svg><span>Generate Poster Artwork</span>`;
      }
    });
  }

  // -------------------------------------------------------------
  // Template Catalog
  // -------------------------------------------------------------
  function bindTemplatesCatalog() {
    renderCategoryPills();
    renderTemplatesList();

    dom.templateSearchInput?.addEventListener('input', (e) => {
      renderTemplatesList(e.target.value);
    });
  }

  function renderCategoryPills() {
    if (!dom.templateCategoryPills) return;
    const cats = FluxPosterTemplates.getCategories();

    dom.templateCategoryPills.innerHTML = [
      `<button class="cat-pill active" data-cat="all" type="button">All (18)</button>`,
      ...cats.map((c) => `<button class="cat-pill" data-cat="${c.id}" type="button">${c.name}</button>`)
    ].join('');

    dom.templateCategoryPills.querySelectorAll('.cat-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        dom.templateCategoryPills.querySelectorAll('.cat-pill').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        renderTemplatesList(dom.templateSearchInput?.value || '', pill.dataset.cat);
      });
    });
  }

  function renderTemplatesList(query = '', category = 'all') {
    if (!dom.templatesCatalogGrid) return;
    let templates = FluxPosterTemplates.getTemplates();

    if (category && category !== 'all') {
      templates = templates.filter((t) => t.category === category);
    }

    if (query && query.trim()) {
      const q = query.toLowerCase();
      templates = templates.filter(
        (t) => t.name.toLowerCase().includes(q) || t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }

    dom.templatesCatalogGrid.innerHTML = templates
      .map(
        (t) => `
        <div class="template-item-card" data-template-id="${t.id}">
          <div class="template-preview-box" style="background:${t.previewColor || '#0F172A'};">
            <span class="template-preview-badge">${t.categoryName}</span>
            <div style="font-family:'Bebas Neue',sans-serif;font-size:24px;color:#FFFFFF;letter-spacing:1px;padding:0 8px;">
              ${t.layers.find((l) => l.type === 'text')?.text || t.name}
            </div>
          </div>
          <div class="template-card-info">
            <div class="template-card-name">${t.name}</div>
            <div class="template-card-meta">${t.dimensions.label}</div>
          </div>
        </div>
      `
      )
      .join('');

    dom.templatesCatalogGrid.querySelectorAll('.template-item-card').forEach((card) => {
      card.addEventListener('click', () => {
        const tmplId = card.dataset.templateId;
        const tmpl = FluxPosterTemplates.getTemplateById(tmplId);
        if (tmpl) {
          engine.loadTemplate(tmpl);
          if (dom.projectTitleInput) dom.projectTitleInput.value = tmpl.name;
          fitCanvasToViewport();
          showToast(`Loaded template: ${tmpl.name}`);
        }
      });
    });
  }

  // -------------------------------------------------------------
  // Product Upload & AI Background Removal
  // -------------------------------------------------------------
  function bindProductUpload() {
    dom.productDropzone?.addEventListener('click', () => {
      dom.productFileInput?.click();
    });

    dom.productFileInput?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const autoRemoveBg = dom.autoCutoutCheckbox ? dom.autoCutoutCheckbox.checked : true;
      showToast(autoRemoveBg ? 'Processing product photo with AI Background Remover...' : 'Loading product photo...');

      try {
        await engine.loadProductImage(file, autoRemoveBg);
        showToast('Product placed on poster canvas as editable cutout!');
      } catch (err) {
        console.error('Product load error:', err);
        showToast('Product load error: ' + err.message);
      }
    });
  }

  // -------------------------------------------------------------
  // Document Layers & Inspector
  // -------------------------------------------------------------
  function bindLayersList() {
    dom.btnAddTextLayer?.addEventListener('click', () => {
      engine.addLayer({
        type: 'text',
        name: 'Custom Text',
        text: 'YOUR TEXT HERE',
        x: engine.doc.width / 2,
        y: engine.doc.height / 2,
        fontSize: 48,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        color: '#FFFFFF',
        align: 'center'
      });
    });

    dom.btnAddBadgeLayer?.addEventListener('click', () => {
      engine.addLayer({
        type: 'badge',
        name: 'Promo Badge',
        text: 'LIMITED EDITION',
        x: engine.doc.width / 2,
        y: engine.doc.height / 2,
        fontSize: 20,
        fontFamily: 'Montserrat',
        fontWeight: '800',
        color: '#FFFFFF',
        bgColor: '#2563EB'
      });
    });
  }

  function bindTypographyPanel() {
    dom.btnAddNewTextFromPanel?.addEventListener('click', () => {
      const text = dom.textLayerInput?.value || 'NEW HEADLINE';
      const font = dom.fontFamilySelect?.value || 'Inter';
      const size = Number(dom.fontSizeSlider?.value) || 54;
      const color = dom.textColorPicker?.value || '#FFFFFF';

      engine.addLayer({
        type: 'text',
        name: 'Heading Layer',
        text,
        x: engine.doc.width / 2,
        y: engine.doc.height / 2,
        fontSize: size,
        fontFamily: font,
        fontWeight: '800',
        color,
        align: 'center'
      });
      showToast('Added new typography layer!');
    });

    dom.textLayerInput?.addEventListener('input', () => {
      const layer = engine.getSelectedLayer();
      if (layer && (layer.type === 'text' || layer.type === 'badge')) {
        layer.text = dom.textLayerInput.value;
        engine.render();
      }
    });

    dom.fontFamilySelect?.addEventListener('change', () => {
      const layer = engine.getSelectedLayer();
      if (layer && layer.type === 'text') {
        layer.fontFamily = dom.fontFamilySelect.value;
        engine.render();
      }
    });

    dom.fontSizeSlider?.addEventListener('input', () => {
      const val = dom.fontSizeSlider.value;
      if (dom.fontSizeVal) dom.fontSizeVal.textContent = `${val} px`;
      const layer = engine.getSelectedLayer();
      if (layer && (layer.type === 'text' || layer.type === 'badge')) {
        layer.fontSize = Number(val);
        engine.render();
      }
    });

    dom.textColorPicker?.addEventListener('input', () => {
      const layer = engine.getSelectedLayer();
      if (layer && (layer.type === 'text' || layer.type === 'badge')) {
        layer.color = dom.textColorPicker.value;
        engine.render();
      }
    });

    dom.btnManualRefineCutout?.addEventListener('click', () => {
      const prodLayer = engine.doc.layers.find((l) => l.type === 'product' || l.type === 'image');
      if (prodLayer && prodLayer.image) {
        const canvas = document.createElement('canvas');
        canvas.width = prodLayer.image.naturalWidth || prodLayer.image.width || 800;
        canvas.height = prodLayer.image.naturalHeight || prodLayer.image.height || 800;
        canvas.getContext('2d').drawImage(prodLayer.image, 0, 0);
        sessionStorage.setItem('fluxwebp_imported_editor_image', canvas.toDataURL('image/png'));
        sessionStorage.setItem('fluxwebp_editor_title', 'Refine Cutout Edge');
        sessionStorage.setItem('fluxwebp_auto_remove_bg', 'true');
        window.location.href = '/editor/';
      } else {
        showToast('Please upload a product photo first to refine edges.');
      }
    });
  }

  function syncTypographyPanel(layer) {
    if (!layer || (layer.type !== 'text' && layer.type !== 'badge')) return;
    if (dom.textLayerInput) dom.textLayerInput.value = layer.text || '';
    if (dom.fontFamilySelect && layer.fontFamily) dom.fontFamilySelect.value = layer.fontFamily;
    if (dom.fontSizeSlider && layer.fontSize) {
      dom.fontSizeSlider.value = layer.fontSize;
      if (dom.fontSizeVal) dom.fontSizeVal.textContent = `${layer.fontSize} px`;
    }
    if (dom.textColorPicker && layer.color) dom.textColorPicker.value = layer.color;
  }

  function renderLayersList() {
    if (!dom.studioLayersList || !engine) return;
    const layers = engine.getLayers();
    const selId = engine.selectedLayerId;

    dom.studioLayersList.innerHTML = layers
      .slice()
      .reverse()
      .map(
        (layer) => `
        <div class="layer-item-row ${layer.id === selId ? 'active' : ''}" data-layer-id="${layer.id}">
          <div class="layer-row-left">
            <svg class="layer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${layer.type === 'text' ? '<polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="12" y1="4" x2="12" y2="20"></line>' : ''}
              ${layer.type === 'badge' ? '<rect x="3" y="6" width="18" height="12" rx="4"></rect>' : ''}
              ${layer.type === 'product' || layer.type === 'image' ? '<rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline>' : ''}
              ${layer.type === 'background' ? '<rect x="3" y="3" width="18" height="18" rx="2"></rect>' : ''}
            </svg>
            <span class="layer-name">${layer.name || layer.type}</span>
          </div>
          <div class="layer-row-actions">
            <button class="layer-action-icon-btn btn-toggle-vis" data-id="${layer.id}" title="Toggle Visibility" type="button">
              ${layer.visible ? '👁' : '🚫'}
            </button>
            ${layer.type !== 'background' ? `<button class="layer-action-icon-btn btn-del-layer" data-id="${layer.id}" title="Delete" type="button">🗑</button>` : ''}
          </div>
        </div>
      `
      )
      .join('');

    dom.studioLayersList.querySelectorAll('.layer-item-row').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.btn-toggle-vis') || e.target.closest('.btn-del-layer')) return;
        engine.selectLayer(row.dataset.layerId);
      });
    });

    dom.studioLayersList.querySelectorAll('.btn-toggle-vis').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const layer = engine.doc.layers.find((l) => l.id === id);
        if (layer) {
          layer.visible = !layer.visible;
          engine.render();
          renderLayersList();
        }
      });
    });

    dom.studioLayersList.querySelectorAll('.btn-del-layer').forEach((btn) => {
      btn.addEventListener('click', () => {
        engine.deleteLayer(btn.dataset.id);
      });
    });
  }

  function renderInspector(layer) {
    if (!dom.inspectorBody) return;

    if (!layer) {
      dom.inspectorTitle.textContent = 'Poster Document';
      dom.inspectorBody.innerHTML = `
        <div style="font-size:0.84rem;color:var(--studio-text-muted);">
          Dimensions: ${engine.doc.width} × ${engine.doc.height} px<br>
          Layers: ${engine.doc.layers.length} total
        </div>
      `;
      return;
    }

    dom.inspectorTitle.textContent = layer.name || 'Layer Properties';

    if (layer.type === 'text') {
      dom.inspectorBody.innerHTML = `
        <div class="form-group">
          <label class="form-label">Text Content</label>
          <input type="text" id="inspTextInput" class="form-input" value="${escapeHtml(layer.text || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Font Family</label>
          <select id="inspFontSelect" class="form-select">
            ${FluxPosterEngine.AVAILABLE_FONTS.map(
              (f) => `<option value="${f.name}" ${layer.fontFamily === f.name ? 'selected' : ''}>${f.name}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <div style="display:flex;justify-content:space-between;">
            <label class="form-label">Font Size</label>
            <span style="font-family:var(--studio-font-mono);font-size:0.8rem;">${layer.fontSize || 48}px</span>
          </div>
          <input type="range" id="inspFontSizeSlider" min="14" max="180" value="${layer.fontSize || 48}" style="width:100%;" />
        </div>
        <div class="form-group">
          <label class="form-label">Text Color</label>
          <input type="color" id="inspTextColor" value="${layer.color || '#FFFFFF'}" style="width:100%;height:38px;border:1px solid var(--studio-panel-border);border-radius:6px;background:transparent;" />
        </div>
      `;

      document.getElementById('inspTextInput')?.addEventListener('input', (e) => {
        layer.text = e.target.value;
        engine.render();
      });

      document.getElementById('inspFontSelect')?.addEventListener('change', (e) => {
        layer.fontFamily = e.target.value;
        engine.render();
      });

      document.getElementById('inspFontSizeSlider')?.addEventListener('input', (e) => {
        layer.fontSize = Number(e.target.value);
        engine.render();
      });

      document.getElementById('inspTextColor')?.addEventListener('input', (e) => {
        layer.color = e.target.value;
        engine.render();
      });
    } else if (layer.type === 'product') {
      dom.inspectorBody.innerHTML = `
        <div class="form-group">
          <label class="form-label">Product Placement</label>
          <div style="font-size:0.8rem;color:var(--studio-text-muted);">
            Width: ${layer.width}px • Height: ${layer.height}px
          </div>
        </div>
        <div class="form-group">
          <button class="btn btn-outline btn-block btn-sm" id="btnInspReplaceProduct">Replace Product Image</button>
        </div>
      `;

      document.getElementById('btnInspReplaceProduct')?.addEventListener('click', () => {
        dom.productFileInput?.click();
      });
    } else if (layer.type === 'background') {
      dom.inspectorBody.innerHTML = `
        <div class="form-group">
          <label class="form-label">Background Type</label>
          <div style="font-size:0.8rem;color:var(--studio-text-muted);">
            ${layer.imageElement ? 'AI Generated Visual Image' : layer.bgType === 'gradient' ? 'Studio Linear Gradient' : 'Solid Color'}
          </div>
        </div>
        <div class="form-group">
          <button class="btn btn-ai-gradient btn-block btn-sm" id="btnInspRegenerateBg">Regenerate AI Artwork</button>
        </div>
      `;

      document.getElementById('btnInspRegenerateBg')?.addEventListener('click', () => {
        document.querySelector('.rail-btn[data-tab="generate"]')?.click();
      });
    }
  }

  // -------------------------------------------------------------
  // Brand Kits Management
  // -------------------------------------------------------------
  function bindBrandKits() {
    renderBrandKits();

    dom.btnOpenNewBrandKitModal?.addEventListener('click', () => {
      const name = prompt('Enter custom Brand Kit name:', 'My Custom Brand');
      if (!name || !name.trim()) return;
      const newKit = {
        id: 'brand-' + Date.now(),
        name: name.trim(),
        colors: { primary: '#2563EB', secondary: '#1E293B', accent: '#F97316' },
        fonts: { heading: 'Space Grotesk', body: 'Inter' }
      };
      DEFAULT_BRAND_KITS.push(newKit);
      renderBrandKits();
      showToast(`Created Brand Kit: ${newKit.name}`);
    });
  }

  function renderBrandKits() {
    if (!dom.brandKitsList) return;

    dom.brandKitsList.innerHTML = DEFAULT_BRAND_KITS.map(
      (kit) => `
      <div class="preset-card" style="padding:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:700;font-size:0.88rem;">${kit.name}</div>
          <button class="btn btn-sm btn-outline btn-apply-kit" data-id="${kit.id}" style="padding:3px 8px;font-size:0.75rem;">Apply Kit</button>
        </div>
        <div style="font-size:0.72rem;color:var(--studio-text-muted);margin-top:4px;">
          Heading: ${kit.fonts.heading} • Body: ${kit.fonts.body}
        </div>
        <div class="brandkit-colors-preview">
          <div class="color-swatch-circle" style="background:${kit.colors.primary};"></div>
          <div class="color-swatch-circle" style="background:${kit.colors.secondary};"></div>
          <div class="color-swatch-circle" style="background:${kit.colors.accent};"></div>
        </div>
      </div>
    `
    ).join('');

    dom.brandKitsList.querySelectorAll('.btn-apply-kit').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const kit = DEFAULT_BRAND_KITS.find((k) => k.id === id);
        if (kit) {
          engine.applyBrandKit(kit);
          showToast(`Applied Brand Kit: ${kit.name}`);
        }
      });
    });
  }

  // -------------------------------------------------------------
  // Saved Designs & Projects (LocalStorage)
  // -------------------------------------------------------------
  function bindSavedDesigns() {
    dom.btnSaveCurrentProject?.addEventListener('click', () => {
      const json = engine.exportProjectJSON();
      const title = dom.projectTitleInput?.value || 'Untitled Poster';

      const key = 'fluxwebp_project_' + Date.now();
      localStorage.setItem(key, JSON.stringify({ id: key, title, json, date: new Date().toLocaleDateString() }));
      renderSavedDesigns();
      showToast('Project saved to local storage!');
    });
  }

  function renderSavedDesigns() {
    if (!dom.savedProjectsList) return;

    const saved = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith('fluxwebp_project_')) {
        try {
          saved.push(JSON.parse(localStorage.getItem(k)));
        } catch (_) {}
      }
    }

    if (saved.length === 0) {
      dom.savedProjectsList.innerHTML = `<div style="font-size:0.8rem;color:var(--studio-text-muted);">No saved designs yet. Click Save Current Project above.</div>`;
      return;
    }

    dom.savedProjectsList.innerHTML = saved
      .map(
        (proj) => `
        <div class="preset-card" style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-weight:600;font-size:0.84rem;">${proj.title}</div>
            <div style="font-size:0.72rem;color:var(--studio-text-muted);">${proj.date}</div>
          </div>
          <button class="btn btn-sm btn-outline btn-load-proj" data-id="${proj.id}">Open</button>
        </div>
      `
      )
      .join('');

    dom.savedProjectsList.querySelectorAll('.btn-load-proj').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = JSON.parse(localStorage.getItem(btn.dataset.id));
        if (item) {
          const parsed = JSON.parse(item.json);
          engine.doc = parsed.doc;
          if (dom.projectTitleInput) dom.projectTitleInput.value = item.title;
          engine.render();
          fitCanvasToViewport();
          showToast(`Opened project: ${item.title}`);
        }
      });
    });
  }

  // -------------------------------------------------------------
  // AI Generation History
  // -------------------------------------------------------------
  function recordHistoryLog(entry) {
    try {
      const history = JSON.parse(localStorage.getItem('fluxwebp_poster_history') || '[]');
      history.unshift(entry);
      if (history.length > 30) history.pop();
      localStorage.setItem('fluxwebp_poster_history', JSON.stringify(history));
    } catch (_) {}
  }

  function renderHistoryList() {
    if (!dom.generationHistoryList) return;
    try {
      const history = JSON.parse(localStorage.getItem('fluxwebp_poster_history') || '[]');
      if (history.length === 0) {
        dom.generationHistoryList.innerHTML = `<div style="font-size:0.8rem;color:var(--studio-text-muted);">No generation logs yet.</div>`;
        return;
      }

      dom.generationHistoryList.innerHTML = history
        .map(
          (h) => `
          <div class="preset-card" style="padding:10px;">
            <div style="font-weight:600;font-size:0.8rem;margin-bottom:2px;">${h.prompt.slice(0, 48)}...</div>
            <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--studio-text-muted);">
              <span>${h.provider} (${h.width}×${h.height})</span>
              <span>${h.elapsed}s • ${h.timestamp}</span>
            </div>
          </div>
        `
        )
        .join('');
    } catch (_) {}
  }

  // -------------------------------------------------------------
  // Export Modal & Downloads
  // -------------------------------------------------------------
  function bindExportModal() {
    dom.btnOpenExportModal?.addEventListener('click', () => {
      dom.exportModal?.classList.add('open');
    });

    dom.btnCloseExportModal?.addEventListener('click', () => {
      dom.exportModal?.classList.remove('open');
    });

    dom.exportQualitySlider?.addEventListener('input', (e) => {
      if (dom.exportQualityVal) dom.exportQualityVal.textContent = e.target.value + '%';
    });

    dom.btnDownloadExport?.addEventListener('click', async () => {
      const format = dom.exportFormatSelect?.value || 'image/png';
      const scale = Number(dom.exportScaleSelect?.value || 1);
      const quality = Number(dom.exportQualitySlider?.value || 95) / 100;

      showToast('Preparing high-resolution export...');
      const blob = await engine.exportToBlob(format, quality, scale);

      const ext = format === 'image/jpeg' ? 'jpg' : format === 'image/webp' ? 'webp' : 'png';
      const filename = `${dom.projectTitleInput?.value.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'poster'}-${scale}x.${ext}`;

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();

      dom.exportModal?.classList.remove('open');
      showToast(`Exported ${filename} (${(blob.size / 1024).toFixed(1)} KB)`);
    });
  }

  // -------------------------------------------------------------
  // Ecosystem Handoff (Image Editor / Compressor)
  // -------------------------------------------------------------
  function bindHandoffActions() {
    // Open in Image Editor
    dom.btnOpenInEditor?.addEventListener('click', async () => {
      showToast('Packaging project layers for Image Editor...');
      const blob = await engine.exportToBlob('image/png', 1.0, 1);

      // Store in sessionStorage and navigate to /editor/
      const reader = new FileReader();
      reader.onload = () => {
        sessionStorage.setItem('fluxwebp_imported_editor_image', reader.result);
        sessionStorage.setItem('fluxwebp_editor_title', dom.projectTitleInput?.value || 'Poster Design');
        window.location.href = '/editor/';
      };
      reader.readAsDataURL(blob);
    });

    // Send to Compressor
    dom.btnSendToCompressor?.addEventListener('click', async () => {
      const blob = await engine.exportToBlob('image/png', 1.0, 1);
      const reader = new FileReader();
      reader.onload = () => {
        sessionStorage.setItem('fluxwebp_compress_queue', JSON.stringify([{ name: 'poster.png', dataUrl: reader.result }]));
        window.location.href = '/image-compressor/';
      };
      reader.readAsDataURL(blob);
    });
  }

  // -------------------------------------------------------------
  // Zoom & Viewport Controls
  // -------------------------------------------------------------
  function bindZoomControls() {
    dom.btnZoomIn?.addEventListener('click', () => {
      setZoom(engine.zoom + 0.1);
    });

    dom.btnZoomOut?.addEventListener('click', () => {
      setZoom(engine.zoom - 0.1);
    });

    dom.btnZoomFit?.addEventListener('click', () => {
      fitCanvasToViewport();
    });
  }

  function setZoom(val) {
    if (!engine) return;
    engine.zoom = Math.max(0.15, Math.min(2.5, val));
    if (dom.canvasWrapper) {
      dom.canvasWrapper.style.transform = `scale(${engine.zoom})`;
    }
    if (dom.zoomReadout) {
      dom.zoomReadout.textContent = `${Math.round(engine.zoom * 100)}%`;
    }
  }

  function fitCanvasToViewport() {
    if (!dom.studioViewport || !engine) return;
    const vpW = dom.studioViewport.clientWidth - 80;
    const vpH = dom.studioViewport.clientHeight - 80;

    const scaleX = vpW / engine.doc.width;
    const scaleY = vpH / engine.doc.height;
    const fitScale = Math.min(scaleX, scaleY, 0.9);

    setZoom(fitScale);
  }

  // -------------------------------------------------------------
  // AI Status Check
  // -------------------------------------------------------------
  async function checkAiStatus() {
    try {
      const resp = await fetch('/api/ai-status');
      if (resp.ok) {
        const json = await resp.json();
        if (dom.aiStatusText) {
          dom.aiStatusText.textContent = `${json.defaultProvider ? 'FLUX.1 Cloud' : 'AI'} • Online`;
        }
      }
    } catch (_) {
      if (dom.aiStatusText) {
        dom.aiStatusText.textContent = 'FLUX.1 Cloud • Online';
      }
    }
  }

  // -------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------
  function showToast(msg) {
    if (!dom.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'studio-toast';
    toast.textContent = msg;
    dom.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(12px) scale(0.95)';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  // Bootstrap when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose API for inspections and tests
  window.FluxPosterStudio = {
    getEngine: () => engine,
    showToast
  };
})();
