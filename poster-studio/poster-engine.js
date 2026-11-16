/**
 * FluxWebP Pro — AI Poster Studio Core Design & Rendering Engine
 * Multi-Layer Document Model, Interactive Transform Gizmos, Typography Engine, and Export Pipeline
 */

(function (global) {
  // Preset Canvas Geometries
  const CANVAS_PRESETS = {
    'ig-square': { name: 'Instagram Square (1:1)', width: 1080, height: 1080, category: 'social' },
    'ig-portrait': { name: 'Instagram Portrait (4:5)', width: 1080, height: 1350, category: 'social' },
    'ig-story': { name: 'Instagram / TikTok Story (9:16)', width: 1080, height: 1920, category: 'social' },
    'fb-post': { name: 'Facebook Post (1:1)', width: 1200, height: 1200, category: 'social' },
    'fb-cover': { name: 'Facebook Cover (2.63:1)', width: 1640, height: 624, category: 'social' },
    'yt-thumb': { name: 'YouTube Thumbnail (16:9)', width: 1280, height: 720, category: 'social' },
    'yt-banner': { name: 'YouTube Channel Banner', width: 2560, height: 1440, category: 'social' },
    'pin-pin': { name: 'Pinterest Pin (2:3)', width: 1000, height: 1500, category: 'social' },
    'li-post': { name: 'LinkedIn Post (1.91:1)', width: 1200, height: 627, category: 'social' },
    'ad-product': { name: 'Product Advertisement (4:5)', width: 1080, height: 1350, category: 'marketing' },
    'ad-promo': { name: 'Promotional Poster (2:3)', width: 1200, height: 1800, category: 'marketing' },
    'ad-event': { name: 'Event Poster (3:4)', width: 1200, height: 1600, category: 'marketing' },
    'print-a4': { name: 'A4 Print Poster (300 DPI)', width: 2480, height: 3508, dpi: 300, category: 'print' },
    'print-a3': { name: 'A3 Print Poster (300 DPI)', width: 3508, height: 4960, dpi: 300, category: 'print' },
    'print-letter': { name: 'US Letter Flyer (300 DPI)', width: 2550, height: 3300, dpi: 300, category: 'print' }
  };

  // Google Fonts preloaded in the studio
  const AVAILABLE_FONTS = [
    { name: 'Inter', family: 'Inter', category: 'sans-serif' },
    { name: 'Montserrat', family: 'Montserrat', category: 'sans-serif' },
    { name: 'Space Grotesk', family: 'Space Grotesk', category: 'monospace' },
    { name: 'Bebas Neue', family: 'Bebas Neue', category: 'display' },
    { name: 'Playfair Display', family: 'Playfair Display', category: 'serif' },
    { name: 'Cinzel', family: 'Cinzel', category: 'serif' },
    { name: 'Oswald', family: 'Oswald', category: 'sans-serif' },
    { name: 'Poppins', family: 'Poppins', category: 'sans-serif' },
    { name: 'Roboto Slab', family: 'Roboto Slab', category: 'slab-serif' },
    { name: 'Pacifico', family: 'Pacifico', category: 'handwriting' }
  ];

  class PosterEngine {
    constructor(canvasElement) {
      this.canvas = canvasElement;
      this.ctx = canvasElement.getContext('2d');

      this.doc = {
        id: 'poster-' + Date.now(),
        title: 'Untitled Poster',
        width: 1080,
        height: 1350,
        dpi: 72,
        layers: [],
        brandKitId: null
      };

      this.selectedLayerId = null;
      this.zoom = 1.0;
      this.panX = 0;
      this.panY = 0;

      // Transform interaction state
      this.interaction = {
        isDragging: false,
        dragHandle: null, // null | 'move' | 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r' | 'rot'
        startX: 0,
        startY: 0,
        initialLayerSnapshot: null
      };

      // History stack
      this.history = [];
      this.historyIndex = -1;
      this.maxHistory = 25;

      this.listeners = {
        selectionChange: [],
        historyChange: [],
        render: []
      };

      this.initEvents();
    }

    // -------------------------------------------------------------
    // Event Subscribers
    // -------------------------------------------------------------
    on(event, cb) {
      if (this.listeners[event]) this.listeners[event].push(cb);
    }

    emit(event, data) {
      if (this.listeners[event]) {
        this.listeners[event].forEach((cb) => cb(data));
      }
    }

    // -------------------------------------------------------------
    // Document Initialization & Presets
    // -------------------------------------------------------------
    setPreset(presetKey) {
      const preset = CANVAS_PRESETS[presetKey] || CANVAS_PRESETS['ig-portrait'];
      this.resizeCanvas(preset.width, preset.height, preset.dpi || 72);
      this.pushHistory(`Apply Canvas Preset (${preset.name})`);
    }

    resizeCanvas(w, h, dpi = 72) {
      this.doc.width = w;
      this.doc.height = h;
      this.doc.dpi = dpi;
      this.canvas.width = w;
      this.canvas.height = h;
      this.render();
      this.emit('render', this.doc);
    }

    loadTemplate(template) {
      if (!template) return;
      this.doc.title = template.name;
      this.doc.width = template.dimensions?.width || 1080;
      this.doc.height = template.dimensions?.height || 1350;
      this.canvas.width = this.doc.width;
      this.canvas.height = this.doc.height;

      // Deep clone layers
      this.doc.layers = JSON.parse(JSON.stringify(template.layers || []));

      // Resolve images/placeholders
      this.selectedLayerId = this.doc.layers[0]?.id || null;
      this.history = [];
      this.historyIndex = -1;
      this.pushHistory(`Load Template: ${template.name}`);
      this.render();
      this.emit('selectionChange', this.getSelectedLayer());
    }

    // -------------------------------------------------------------
    // Layer Operations
    // -------------------------------------------------------------
    getLayers() {
      return this.doc.layers;
    }

    getSelectedLayer() {
      return this.doc.layers.find((l) => l.id === this.selectedLayerId) || null;
    }

    selectLayer(id) {
      this.selectedLayerId = id;
      this.render();
      this.emit('selectionChange', this.getSelectedLayer());
    }

    addLayer(layer) {
      layer.id = layer.id || 'layer-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      layer.visible = layer.visible !== false;
      layer.locked = !!layer.locked;
      layer.opacity = typeof layer.opacity === 'number' ? layer.opacity : 1.0;
      layer.rotation = layer.rotation || 0;

      this.doc.layers.push(layer);
      this.selectedLayerId = layer.id;
      this.pushHistory(`Add Layer (${layer.name || layer.type})`);
      this.render();
      this.emit('selectionChange', layer);
      return layer;
    }

    updateLayer(id, updates) {
      const layer = this.doc.layers.find((l) => l.id === id);
      if (!layer) return;
      Object.assign(layer, updates);
      this.render();
      this.emit('selectionChange', layer);
    }

    deleteLayer(id) {
      const idx = this.doc.layers.findIndex((l) => l.id === id);
      if (idx === -1) return;
      const removed = this.doc.layers.splice(idx, 1)[0];
      if (this.selectedLayerId === id) {
        this.selectedLayerId = this.doc.layers[Math.max(0, idx - 1)]?.id || null;
      }
      this.pushHistory(`Delete Layer (${removed.name || removed.type})`);
      this.render();
      this.emit('selectionChange', this.getSelectedLayer());
    }

    duplicateLayer(id) {
      const layer = this.doc.layers.find((l) => l.id === id);
      if (!layer) return;
      const clone = JSON.parse(JSON.stringify(layer));
      clone.id = 'layer-' + Date.now();
      clone.name = (layer.name || 'Layer') + ' (Copy)';
      clone.x = (clone.x || 0) + 30;
      clone.y = (clone.y || 0) + 30;

      const idx = this.doc.layers.findIndex((l) => l.id === id);
      this.doc.layers.splice(idx + 1, 0, clone);
      this.selectedLayerId = clone.id;
      this.pushHistory(`Duplicate Layer (${clone.name})`);
      this.render();
      this.emit('selectionChange', clone);
    }

    reorderLayer(id, newIndex) {
      const curIndex = this.doc.layers.findIndex((l) => l.id === id);
      if (curIndex === -1 || newIndex < 0 || newIndex >= this.doc.layers.length) return;
      const [layer] = this.doc.layers.splice(curIndex, 1);
      this.doc.layers.splice(newIndex, 0, layer);
      this.pushHistory(`Reorder Layer (${layer.name})`);
      this.render();
    }

    // -------------------------------------------------------------
    // History & Undo / Redo
    // -------------------------------------------------------------
    pushHistory(actionName = 'Edit Poster') {
      // Discard future states if branching
      this.history = this.history.slice(0, this.historyIndex + 1);

      // Deep serialize current document state
      const snapshot = {
        name: actionName,
        doc: JSON.parse(JSON.stringify(this.doc)),
        selectedLayerId: this.selectedLayerId
      };

      this.history.push(snapshot);
      if (this.history.length > this.maxHistory) {
        this.history.shift();
      }
      this.historyIndex = this.history.length - 1;
      this.emit('historyChange', { canUndo: this.historyIndex > 0, canRedo: false });
    }

    undo() {
      if (this.historyIndex <= 0) return;
      this.historyIndex--;
      const snapshot = this.history[this.historyIndex];
      this.doc = JSON.parse(JSON.stringify(snapshot.doc));
      this.selectedLayerId = snapshot.selectedLayerId;
      this.render();
      this.emit('historyChange', {
        canUndo: this.historyIndex > 0,
        canRedo: this.historyIndex < this.history.length - 1
      });
      this.emit('selectionChange', this.getSelectedLayer());
    }

    redo() {
      if (this.historyIndex >= this.history.length - 1) return;
      this.historyIndex++;
      const snapshot = this.history[this.historyIndex];
      this.doc = JSON.parse(JSON.stringify(snapshot.doc));
      this.selectedLayerId = snapshot.selectedLayerId;
      this.render();
      this.emit('historyChange', {
        canUndo: this.historyIndex > 0,
        canRedo: this.historyIndex < this.history.length - 1
      });
      this.emit('selectionChange', this.getSelectedLayer());
    }

    // -------------------------------------------------------------
    // Rendering Pipeline
    // -------------------------------------------------------------
    render() {
      const { width, height } = this.doc;
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }

      this.ctx.save();
      this.ctx.clearRect(0, 0, width, height);

      // 1. Render all document layers bottom-to-top
      this.doc.layers.forEach((layer) => {
        if (!layer.visible) return;
        this.renderLayer(layer);
      });

      // 2. Render Selection Bounding Box & Transform Gizmo for active layer
      const activeLayer = this.getSelectedLayer();
      if (activeLayer && !activeLayer.locked && activeLayer.type !== 'background') {
        this.renderTransformGizmo(activeLayer);
      }

      this.ctx.restore();
      this.emit('render', this.doc);
    }

    renderLayer(layer) {
      this.ctx.save();
      this.ctx.globalAlpha = typeof layer.opacity === 'number' ? layer.opacity : 1.0;

      switch (layer.type) {
        case 'background':
          this.renderBackgroundLayer(layer);
          break;
        case 'product':
          this.renderProductLayer(layer);
          break;
        case 'image':
          this.renderImageLayer(layer);
          break;
        case 'text':
          this.renderTextLayer(layer);
          break;
        case 'badge':
          this.renderBadgeLayer(layer);
          break;
        case 'shape':
          this.renderShapeLayer(layer);
          break;
      }

      this.ctx.restore();
    }

    renderBackgroundLayer(layer) {
      const { width, height } = this.doc;

      if (layer.imageElement) {
        // AI Generated Visual Image
        this.ctx.drawImage(layer.imageElement, 0, 0, width, height);
      } else if (layer.bgType === 'gradient') {
        const start = layer.gradientStart || '#0F172A';
        const end = layer.gradientEnd || '#1E293B';
        const angle = (layer.angle || 135) * (Math.PI / 180);

        const x1 = width / 2 - (Math.cos(angle) * width) / 2;
        const y1 = height / 2 - (Math.sin(angle) * height) / 2;
        const x2 = width / 2 + (Math.cos(angle) * width) / 2;
        const y2 = height / 2 + (Math.sin(angle) * height) / 2;

        const grad = this.ctx.createLinearGradient(x1, y1, x2, y2);
        grad.addColorStop(0, start);
        grad.addColorStop(1, end);
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, width, height);
      } else {
        this.ctx.fillStyle = layer.color || '#0F172A';
        this.ctx.fillRect(0, 0, width, height);
      }
    }

    renderProductLayer(layer) {
      const x = layer.x || 0;
      const y = layer.y || 0;
      const w = layer.width || 400;
      const h = layer.height || 400;

      this.ctx.save();
      if (layer.rotation) {
        const cx = x + w / 2;
        const cy = y + h / 2;
        this.ctx.translate(cx, cy);
        this.ctx.rotate((layer.rotation * Math.PI) / 180);
        this.ctx.translate(-cx, -cy);
      }

      if (layer.imageElement) {
        // Cast subtle drop shadow
        if (layer.dropShadow !== false) {
          this.ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
          this.ctx.shadowBlur = 32;
          this.ctx.shadowOffsetY = 16;
        }
        this.ctx.drawImage(layer.imageElement, x, y, w, h);
      } else {
        // Render dashed interactive placeholder box
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([12, 8]);
        this.ctx.fillStyle = 'rgba(56, 189, 248, 0.05)';
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, w, h, 16);
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.fillStyle = '#38BDF8';
        this.ctx.font = '600 20px "Space Grotesk", sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(layer.placeholderText || 'Drop Product Image Here (AI Cutout)', x + w / 2, y + h / 2);
        this.ctx.restore();
      }

      this.ctx.restore();
    }

    renderImageLayer(layer) {
      if (!layer.imageElement) return;
      const x = layer.x || 0;
      const y = layer.y || 0;
      const w = layer.width || 200;
      const h = layer.height || 200;

      this.ctx.save();
      if (layer.rotation) {
        const cx = x + w / 2;
        const cy = y + h / 2;
        this.ctx.translate(cx, cy);
        this.ctx.rotate((layer.rotation * Math.PI) / 180);
        this.ctx.translate(-cx, -cy);
      }
      this.ctx.drawImage(layer.imageElement, x, y, w, h);
      this.ctx.restore();
    }

    renderTextLayer(layer) {
      const fontSize = layer.fontSize || 32;
      const fontFamily = layer.fontFamily || 'Inter';
      const fontWeight = layer.fontWeight || '400';
      const color = layer.color || '#FFFFFF';
      const align = layer.align || 'center';
      let text = layer.text || '';
      if (layer.textTransform === 'uppercase') text = text.toUpperCase();

      this.ctx.save();
      this.ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}", sans-serif`;
      this.ctx.textAlign = align;
      this.ctx.textBaseline = 'top';

      if (layer.shadowColor) {
        this.ctx.shadowColor = layer.shadowColor;
        this.ctx.shadowBlur = layer.shadowBlur || 12;
        this.ctx.shadowOffsetX = layer.shadowX || 0;
        this.ctx.shadowOffsetY = layer.shadowY || 6;
      }

      this.ctx.fillStyle = color;

      // Handle letter-spacing if supported or render standard
      if (layer.letterSpacing && this.ctx.letterSpacing !== undefined) {
        this.ctx.letterSpacing = `${layer.letterSpacing}px`;
      }

      // Word wrapping without truncating titles
      const maxWidth = layer.width || (this.doc.width - 80);
      const lineHeight = fontSize * (layer.lineHeight || 1.25);
      const paragraphs = String(text).split('\n');
      let currentY = layer.y;

      paragraphs.forEach((para) => {
        const words = para.split(' ');
        let currentLine = '';

        for (let i = 0; i < words.length; i++) {
          const testLine = currentLine ? `${currentLine} ${words[i]}` : words[i];
          const testWidth = this.ctx.measureText(testLine).width;
          if (testWidth > maxWidth && i > 0) {
            this.ctx.fillText(currentLine, layer.x, currentY);
            currentLine = words[i];
            currentY += lineHeight;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) {
          this.ctx.fillText(currentLine, layer.x, currentY);
          currentY += lineHeight;
        }
      });

      this.ctx.restore();
    }

    renderBadgeLayer(layer) {
      const text = layer.text || 'BADGE';
      const fontSize = layer.fontSize || 18;
      const fontFamily = layer.fontFamily || 'Montserrat';
      const fontWeight = layer.fontWeight || '700';
      const color = layer.color || '#FFFFFF';
      const bgColor = layer.bgColor || '#2563EB';
      const paddingX = layer.paddingX || 24;
      const paddingY = layer.paddingY || 8;
      const radius = typeof layer.borderRadius === 'number' ? layer.borderRadius : 16;

      this.ctx.save();
      this.ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}", sans-serif`;
      const metrics = this.ctx.measureText(text);
      const textW = metrics.width;
      const textH = fontSize;

      const totalW = textW + paddingX * 2;
      const totalH = textH + paddingY * 2;

      let rx = layer.x - totalW / 2;
      let ry = layer.y;
      if (layer.align === 'left') rx = layer.x;

      // Draw background pill
      this.ctx.fillStyle = bgColor;
      this.ctx.beginPath();
      this.ctx.roundRect(rx, ry, totalW, totalH, radius);
      this.ctx.fill();

      // Draw text
      this.ctx.fillStyle = color;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(text, rx + totalW / 2, ry + totalH / 2);
      this.ctx.restore();
    }

    renderShapeLayer(layer) {
      const x = layer.x || 0;
      const y = layer.y || 0;
      const w = layer.width || 200;
      const h = layer.height || 200;

      this.ctx.save();
      this.ctx.fillStyle = layer.fillColor || 'transparent';
      this.ctx.strokeStyle = layer.strokeColor || '#FFFFFF';
      this.ctx.lineWidth = layer.strokeWidth || 2;

      if (layer.shapeType === 'circle') {
        this.ctx.beginPath();
        this.ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        if (layer.fillColor) this.ctx.fill();
        if (layer.strokeWidth) this.ctx.stroke();
      } else {
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, w, h, layer.borderRadius || 0);
        if (layer.fillColor) this.ctx.fill();
        if (layer.strokeWidth) this.ctx.stroke();
      }
      this.ctx.restore();
    }

    // -------------------------------------------------------------
    // Transform Gizmo & Bounding Box
    // -------------------------------------------------------------
    getLayerBounds(layer) {
      if (layer.type === 'product' || layer.type === 'image' || layer.type === 'shape') {
        return { x: layer.x || 0, y: layer.y || 0, w: layer.width || 200, h: layer.height || 200 };
      }

      if (layer.type === 'text') {
        this.ctx.save();
        this.ctx.font = `${layer.fontWeight || '400'} ${layer.fontSize || 32}px "${layer.fontFamily || 'Inter'}", sans-serif`;
        const metrics = this.ctx.measureText(layer.text || '');
        const w = metrics.width + (layer.letterSpacing ? (layer.text.length * layer.letterSpacing) : 0);
        const h = (layer.fontSize || 32) * 1.25;
        this.ctx.restore();

        let x = layer.x;
        if (layer.align === 'center') x = layer.x - w / 2;
        if (layer.align === 'right') x = layer.x - w;
        return { x, y: layer.y, w, h };
      }

      if (layer.type === 'badge') {
        this.ctx.save();
        this.ctx.font = `${layer.fontWeight || '700'} ${layer.fontSize || 18}px "${layer.fontFamily || 'Montserrat'}", sans-serif`;
        const metrics = this.ctx.measureText(layer.text || 'BADGE');
        const totalW = metrics.width + (layer.paddingX || 24) * 2;
        const totalH = (layer.fontSize || 18) + (layer.paddingY || 8) * 2;
        this.ctx.restore();

        let x = layer.x - totalW / 2;
        if (layer.align === 'left') x = layer.x;
        return { x, y: layer.y, w: totalW, h: totalH };
      }

      return { x: 0, y: 0, w: 0, h: 0 };
    }

    renderTransformGizmo(layer) {
      const bounds = this.getLayerBounds(layer);
      const { x, y, w, h } = bounds;

      this.ctx.save();
      this.ctx.strokeStyle = '#2563EB';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);

      // Render 8 Resize Handles
      const handleSize = 10;
      const half = handleSize / 2;
      const handles = [
        { key: 'tl', x: x - half, y: y - half },
        { key: 'tr', x: x + w - half, y: y - half },
        { key: 'bl', x: x - half, y: y + h - half },
        { key: 'br', x: x + w - half, y: y + h - half }
      ];

      this.ctx.fillStyle = '#FFFFFF';
      handles.forEach((hnd) => {
        this.ctx.fillRect(hnd.x, hnd.y, handleSize, handleSize);
        this.ctx.strokeRect(hnd.x, hnd.y, handleSize, handleSize);
      });

      // Rotation stalk & handle at top
      const rotY = y - 28;
      this.ctx.beginPath();
      this.ctx.moveTo(x + w / 2, y);
      this.ctx.lineTo(x + w / 2, rotY);
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.arc(x + w / 2, rotY, 6, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.restore();
    }

    // -------------------------------------------------------------
    // Interactive Mouse / Pointer Handling
    // -------------------------------------------------------------
    initEvents() {
      const c = this.canvas;
      if (!c || !c.addEventListener) return;

      c.addEventListener('pointerdown', (e) => this.onPointerDown(e));
      if (typeof window !== 'undefined') {
        window.addEventListener('pointermove', (e) => this.onPointerMove(e));
        window.addEventListener('pointerup', (e) => this.onPointerUp(e));
      }
    }

    toCanvasCoords(e) {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.doc.width / rect.width;
      const scaleY = this.doc.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }

    onPointerDown(e) {
      const pos = this.toCanvasCoords(e);
      const activeLayer = this.getSelectedLayer();

      // Check if clicking rotation handle
      if (activeLayer && !activeLayer.locked && activeLayer.type !== 'background') {
        const bounds = this.getLayerBounds(activeLayer);
        const rotX = bounds.x + bounds.w / 2;
        const rotY = bounds.y - 28;
        const dist = Math.hypot(pos.x - rotX, pos.y - rotY);
        if (dist <= 16) {
          this.interaction.isDragging = true;
          this.interaction.dragHandle = 'rot';
          this.interaction.startX = pos.x;
          this.interaction.startY = pos.y;
          this.interaction.initialLayerSnapshot = JSON.parse(JSON.stringify(activeLayer));
          return;
        }

        // Check if clicking resize handles
        const handles = [
          { key: 'tl', x: bounds.x, y: bounds.y },
          { key: 'tr', x: bounds.x + bounds.w, y: bounds.y },
          { key: 'bl', x: bounds.x, y: bounds.y + bounds.h },
          { key: 'br', x: bounds.x + bounds.w, y: bounds.y + bounds.h }
        ];

        for (const hnd of handles) {
          if (Math.hypot(pos.x - hnd.x, pos.y - hnd.y) <= 14) {
            this.interaction.isDragging = true;
            this.interaction.dragHandle = hnd.key;
            this.interaction.startX = pos.x;
            this.interaction.startY = pos.y;
            this.interaction.initialLayerSnapshot = JSON.parse(JSON.stringify(activeLayer));
            return;
          }
        }
      }

      // Check hit test on layers from top to bottom
      let hitLayer = null;
      for (let i = this.doc.layers.length - 1; i >= 0; i--) {
        const layer = this.doc.layers[i];
        if (!layer.visible || layer.locked) continue;
        if (layer.type === 'background') continue; // background is handled separately

        const bounds = this.getLayerBounds(layer);
        if (pos.x >= bounds.x && pos.x <= bounds.x + bounds.w && pos.y >= bounds.y && pos.y <= bounds.y + bounds.h) {
          hitLayer = layer;
          break;
        }
      }

      if (hitLayer) {
        this.selectLayer(hitLayer.id);
        this.interaction.isDragging = true;
        this.interaction.dragHandle = 'move';
        this.interaction.startX = pos.x;
        this.interaction.startY = pos.y;
        this.interaction.initialLayerSnapshot = JSON.parse(JSON.stringify(hitLayer));
      } else {
        // If clicked on canvas background
        const bgLayer = this.doc.layers.find((l) => l.type === 'background');
        if (bgLayer) this.selectLayer(bgLayer.id);
      }
    }

    onPointerMove(e) {
      if (!this.interaction.isDragging) return;
      const pos = this.toCanvasCoords(e);
      const activeLayer = this.getSelectedLayer();
      if (!activeLayer || !this.interaction.initialLayerSnapshot) return;

      const init = this.interaction.initialLayerSnapshot;
      const dx = pos.x - this.interaction.startX;
      const dy = pos.y - this.interaction.startY;

      if (this.interaction.dragHandle === 'move') {
        activeLayer.x = Math.round(init.x + dx);
        activeLayer.y = Math.round(init.y + dy);
      } else if (this.interaction.dragHandle === 'br') {
        if (init.width && init.height) {
          activeLayer.width = Math.max(50, Math.round(init.width + dx));
          activeLayer.height = Math.max(50, Math.round(init.height + dy));
        } else if (init.fontSize) {
          activeLayer.fontSize = Math.max(12, Math.round(init.fontSize + dy * 0.5));
        }
      } else if (this.interaction.dragHandle === 'rot') {
        const bounds = this.getLayerBounds(activeLayer);
        const cx = bounds.x + bounds.w / 2;
        const cy = bounds.y + bounds.h / 2;
        const rad = Math.atan2(pos.y - cy, pos.x - cx);
        activeLayer.rotation = Math.round((rad * 180) / Math.PI + 90);
      }

      this.render();
    }

    onPointerUp() {
      if (this.interaction.isDragging) {
        this.interaction.isDragging = false;
        this.interaction.dragHandle = null;
        this.interaction.initialLayerSnapshot = null;
        this.pushHistory('Transform Layer');
      }
    }

    // -------------------------------------------------------------
    // Product Upload & AI Background Removal Integration
    // -------------------------------------------------------------
    async loadProductImage(fileOrBlob, autoRemoveBg = true) {
      const activeLayer = this.getSelectedLayer();
      const targetLayer = activeLayer?.type === 'product' ? activeLayer : this.doc.layers.find((l) => l.type === 'product');

      if (!targetLayer) {
        throw new Error('No product layer found in this poster document.');
      }

      const img = new Image();
      const url = URL.createObjectURL(fileOrBlob);

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });

      let finalCanvas = document.createElement('canvas');
      finalCanvas.width = img.naturalWidth || img.width;
      finalCanvas.height = img.naturalHeight || img.height;
      finalCanvas.getContext('2d').drawImage(img, 0, 0);

      // Trigger real AI Background Remover if available & requested
      if (autoRemoveBg && global.FluxBgRemover) {
        try {
          const cutoutResult = await global.FluxBgRemover.removeBackground(finalCanvas);
          finalCanvas = cutoutResult.resultCanvas;
        } catch (e) {
          console.warn('AI Cutout failed or fell back:', e);
        }
      }

      targetLayer.imageElement = finalCanvas;
      targetLayer.placeholderText = null;

      // Adjust dimensions preserving aspect ratio
      const aspect = finalCanvas.width / finalCanvas.height;
      targetLayer.width = Math.min(this.doc.width * 0.8, targetLayer.width || 600);
      targetLayer.height = Math.round(targetLayer.width / aspect);

      this.pushHistory('Upload Product Reference Image');
      this.render();
      return targetLayer;
    }

    // -------------------------------------------------------------
    // AI Artwork Generation Integration
    // -------------------------------------------------------------
    async generatePosterVisual(prompt, options = {}) {
      const bgLayer = this.doc.layers.find((l) => l.type === 'background');
      if (!bgLayer) return;

      const payload = {
        prompt,
        width: this.doc.width,
        height: this.doc.height,
        style: options.style || 'commercial-advertising',
        provider: options.provider || 'flux-community',
        seed: options.seed || Math.floor(Math.random() * 1000000)
      };

      let result = null;

      try {
        // 1. Try serverless endpoint first
        const resp = await fetch('/api/generate-poster', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(options.customApiKey ? { 'x-custom-api-key': options.customApiKey } : {}),
            ...(options.provider ? { 'x-provider': options.provider } : {})
          },
          body: JSON.stringify(payload)
        });

        const json = await resp.json();
        if (resp.ok && json.success) {
          result = json;
        } else {
          throw new Error(json.error || 'Serverless generation error');
        }
      } catch (err) {
        console.warn('Serverless generation endpoint unavailable, using direct public FLUX fallback:', err.message);

        // 2. Direct public cloud FLUX fallback (Watermark-free, authentic AI generation)
        const encoded = encodeURIComponent(prompt + ', masterpiece commercial photography 8k');
        const fallbackUrl = `https://image.pollinations.ai/prompt/${encoded}?width=${this.doc.width}&height=${this.doc.height}&nologo=true&model=flux`;

        result = {
          success: true,
          imageUrl: fallbackUrl,
          provider: 'FLUX.1 Direct Cloud',
          model: 'black-forest-labs/FLUX.1-schnell'
        };
      }

      // Load resulting image onto background layer
      const aiImg = new Image();
      aiImg.crossOrigin = 'anonymous';

      await new Promise((resolve, reject) => {
        aiImg.onload = resolve;
        aiImg.onerror = reject;
        aiImg.src = result.imageUrl;
      });

      bgLayer.imageElement = aiImg;
      bgLayer.prompt = prompt;
      bgLayer.provider = result.provider;

      this.pushHistory(`AI Generate Artwork: ${prompt.slice(0, 30)}...`);
      this.render();
      return result;
    }

    // -------------------------------------------------------------
    // Brand Kit Application
    // -------------------------------------------------------------
    applyBrandKit(brandKit) {
      if (!brandKit) return;
      this.doc.brandKitId = brandKit.id;

      // Update color scheme across text & badges
      this.doc.layers.forEach((layer) => {
        if (layer.type === 'badge' && brandKit.colors?.primary) {
          layer.bgColor = brandKit.colors.primary;
        }
        if (layer.type === 'text' && layer.name?.includes('Headline') && brandKit.fonts?.heading) {
          layer.fontFamily = brandKit.fonts.heading;
        }
      });

      // Inject Brand Logo if available
      if (brandKit.logoUrl) {
        let logoLayer = this.doc.layers.find((l) => l.name === 'Brand Logo');
        if (!logoLayer) {
          const logoImg = new Image();
          logoImg.onload = () => {
            const aspect = logoImg.width / logoImg.height;
            const logoW = 160;
            const logoH = Math.round(logoW / aspect);
            this.addLayer({
              type: 'image',
              name: 'Brand Logo',
              x: 60,
              y: 60,
              width: logoW,
              height: logoH,
              imageElement: logoImg,
              visible: true,
              locked: false
            });
          };
          logoImg.src = brandKit.logoUrl;
        }
      }

      this.pushHistory(`Apply Brand Kit: ${brandKit.name}`);
      this.render();
    }

    // -------------------------------------------------------------
    // Export Pipeline
    // -------------------------------------------------------------
    async exportToBlob(format = 'image/png', arg2 = 0.95, arg3 = 1) {
      let quality = 0.95;
      let multiplier = 1;
      if (typeof arg2 === 'number' && typeof arg3 === 'number') {
        if (arg2 >= 1 && arg3 <= 1 && arg3 > 0) {
          multiplier = arg2;
          quality = arg3;
        } else {
          quality = arg2;
          multiplier = arg3;
        }
      } else if (typeof arg2 === 'number') {
        if (arg2 > 1) multiplier = arg2;
        else quality = arg2;
      }
      const scale = Math.max(0.25, Number(multiplier) || 1);
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = Math.round(this.doc.width * scale);
      exportCanvas.height = Math.round(this.doc.height * scale);
      const eCtx = exportCanvas.getContext('2d');
      eCtx.scale(scale, scale);

      const originalCtx = this.ctx;
      this.ctx = eCtx;
      try {
        this.doc.layers.forEach((layer) => {
          if (!layer.visible) return;
          this.renderLayer(layer);
        });
      } finally {
        this.ctx = originalCtx;
      }

      return new Promise((resolve) => {
        try {
          exportCanvas.toBlob((blob) => {
            if (!blob) {
              try {
                exportCanvas.toBlob((fbBlob) => resolve(fbBlob), 'image/png');
              } catch (_) {
                resolve(null);
              }
            } else {
              resolve(blob);
            }
          }, format, quality);
        } catch (_) {
          try {
            exportCanvas.toBlob((fbBlob) => resolve(fbBlob), 'image/png');
          } catch (_) {
            resolve(null);
          }
        }
      });
    }

    // Project Serialization
    exportProjectJSON() {
      return JSON.stringify(
        {
          schema: 'fluxwebp-poster-v1',
          exportedAt: new Date().toISOString(),
          doc: this.doc
        },
        null,
        2
      );
    }
  }

  global.FluxPosterEngine = {
    PosterEngine,
    CANVAS_PRESETS,
    AVAILABLE_FONTS
  };
})(typeof window !== 'undefined' ? window : global);
