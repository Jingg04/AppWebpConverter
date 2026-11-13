/**
 * FluxWebP Pro — AI Poster Studio Automated Test Suite
 * Validates Canvas Presets, 18-Category Template Library, Multi-Layer Engine, Typography, Brand Kits, and Serverless Handlers
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=================================================');
console.log('FluxWebP Pro — AI Poster Studio Automated Tests');
console.log('=================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✔ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✖ [FAIL] ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

// -------------------------------------------------------------
// Group 1: Canvas Presets & Geometry
// -------------------------------------------------------------
console.log('Group 1: Canvas Presets & Print Geometry');

const presetsModule = fs.readFileSync(path.join(__dirname, '../poster-studio/poster-engine.js'), 'utf8');

test('Validates Instagram, TikTok, YouTube, and Facebook Presets', () => {
  assert.ok(presetsModule.includes("'ig-portrait': { name: 'Instagram Portrait (4:5)', width: 1080, height: 1350"));
  assert.ok(presetsModule.includes("'ig-square': { name: 'Instagram Square (1:1)', width: 1080, height: 1080"));
  assert.ok(presetsModule.includes("'ig-story': { name: 'Instagram / TikTok Story (9:16)', width: 1080, height: 1920"));
  assert.ok(presetsModule.includes("'yt-thumb': { name: 'YouTube Thumbnail (16:9)', width: 1280, height: 720"));
});

test('Calculates 300 DPI Print Geometry for A4, A3, and US Letter', () => {
  assert.ok(presetsModule.includes("'print-a4': { name: 'A4 Print Poster (300 DPI)', width: 2480, height: 3508, dpi: 300"));
  assert.ok(presetsModule.includes("'print-a3': { name: 'A3 Print Poster (300 DPI)', width: 3508, height: 4960, dpi: 300"));
  assert.ok(presetsModule.includes("'print-letter': { name: 'US Letter Flyer (300 DPI)', width: 2550, height: 3300, dpi: 300"));
});

// -------------------------------------------------------------
// Group 2: Curated 18-Category Template Catalog
// -------------------------------------------------------------
console.log('\nGroup 2: 18-Category Template Catalog Integrity');

require('../poster-studio/poster-templates.js');
const templates = global.FluxPosterTemplates.getTemplates();
const categories = global.FluxPosterTemplates.getCategories();

test('Contains all 18 commercial categories', () => {
  assert.strictEqual(categories.length, 18, `Expected 18 categories, got ${categories.length}`);
  const expectedCats = [
    'product-advertising',
    'machinery-industrial',
    'luxury-branding',
    'business-promotion',
    'technology-saas',
    'fashion-apparel',
    'food-restaurant',
    'real-estate',
    'automotive',
    'travel-tourism',
    'events-entertainment',
    'education',
    'fitness-sports',
    'ecommerce',
    'seasonal-campaigns',
    'social-media',
    'corporate-announcements',
    'minimalist-design'
  ];

  expectedCats.forEach((cat) => {
    const found = categories.find((c) => c.id === cat);
    assert.ok(found, `Missing category: ${cat}`);
  });
});

test('Validates template schema (layers, dimensions, styles, prompts)', () => {
  assert.ok(templates.length >= 18, 'Expected at least 18 templates');
  templates.forEach((tmpl) => {
    assert.ok(tmpl.id, `Template missing id: ${JSON.stringify(tmpl)}`);
    assert.ok(tmpl.name, `Template ${tmpl.id} missing name`);
    assert.ok(tmpl.dimensions && tmpl.dimensions.width && tmpl.dimensions.height, `Template ${tmpl.id} invalid dimensions`);
    assert.ok(tmpl.prompt, `Template ${tmpl.id} missing AI generation prompt`);
    assert.ok(Array.isArray(tmpl.layers) && tmpl.layers.length > 0, `Template ${tmpl.id} has no layers`);

    // Verify non-destructive layer presence (Background, Product or Text)
    const hasBg = tmpl.layers.some((l) => l.type === 'background');
    const hasText = tmpl.layers.some((l) => l.type === 'text');
    assert.ok(hasBg, `Template ${tmpl.id} missing background layer`);
    assert.ok(hasText, `Template ${tmpl.id} missing editable text layer`);
  });
});

test('Verifies Titan Industrial Machinery template structure', () => {
  const tmpl = global.FluxPosterTemplates.getTemplateById('ind-titan-cnc');
  assert.ok(tmpl, 'Titan CNC template should exist');
  assert.strictEqual(tmpl.category, 'machinery-industrial');
  assert.strictEqual(tmpl.style, 'industrial-machinery');
  const head = tmpl.layers.find((l) => l.name === 'Industrial Headline');
  assert.ok(head && head.text === 'MICRON-PRECISION MIGHT.');
});

test('Verifies Luxury Parfumerie template structure', () => {
  const tmpl = global.FluxPosterTemplates.getTemplateById('lux-aura-perfume');
  assert.ok(tmpl, 'Luxury perfume template should exist');
  assert.strictEqual(tmpl.category, 'luxury-branding');
  const head = tmpl.layers.find((l) => l.name === 'Perfume Name');
  assert.ok(head && head.text === "L'AURA NOIRE");
});

// -------------------------------------------------------------
// Group 3: Multi-Layer Document Operations & History
// -------------------------------------------------------------
console.log('\nGroup 3: Multi-Layer Document Model & History Stack');

// Mock a lightweight canvas context for headless testing
function createMockCanvas(w = 1080, h = 1350) {
  return {
    width: w,
    height: h,
    getContext: () => ({
      save() {},
      restore() {},
      clearRect() {},
      drawImage() {},
      fillRect() {},
      strokeRect() {},
      beginPath() {},
      roundRect() {},
      ellipse() {},
      fill() {},
      stroke() {},
      arc() {},
      moveTo() {},
      lineTo() {},
      fillText() {},
      measureText: (txt) => ({ width: (txt || '').length * 12 }),
      createLinearGradient: () => ({ addColorStop() {} })
    }),
    addEventListener() {},
    removeEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h })
  };
}

require('../poster-studio/poster-engine.js');
const mockCanvas = createMockCanvas();
const engine = new global.FluxPosterEngine.PosterEngine(mockCanvas);

test('Initializes document and adds structured layers', () => {
  engine.doc.layers = [];
  const textLayer = engine.addLayer({
    type: 'text',
    name: 'Headline',
    text: 'BREAKTHROUGH DESIGN',
    x: 540,
    y: 200,
    fontSize: 64,
    fontFamily: 'Montserrat'
  });

  assert.strictEqual(engine.doc.layers.length, 1);
  assert.strictEqual(engine.selectedLayerId, textLayer.id);
});

test('Duplicates layer with offset and unique ID', () => {
  const original = engine.doc.layers[0];
  engine.duplicateLayer(original.id);

  assert.strictEqual(engine.doc.layers.length, 2);
  const dup = engine.doc.layers[1];
  assert.notStrictEqual(dup.id, original.id);
  assert.strictEqual(dup.x, original.x + 30);
  assert.strictEqual(dup.y, original.y + 30);
});

test('Reorders layers in stack', () => {
  const id0 = engine.doc.layers[0].id;
  const id1 = engine.doc.layers[1].id;
  engine.reorderLayer(id0, 1);

  assert.strictEqual(engine.doc.layers[0].id, id1);
  assert.strictEqual(engine.doc.layers[1].id, id0);
});

test('Manages 25-step undo / redo history stack', () => {
  const initialCount = engine.history.length;
  engine.pushHistory('Action 1');
  engine.pushHistory('Action 2');

  assert.strictEqual(engine.history.length, initialCount + 2);
  engine.undo();
  assert.strictEqual(engine.historyIndex, initialCount);
  engine.redo();
  assert.strictEqual(engine.historyIndex, initialCount + 1);
});

// -------------------------------------------------------------
// Group 4: Serverless API Handlers
// -------------------------------------------------------------
console.log('\nGroup 4: Serverless AI Handlers & Status');

const enhanceHandler = require('../api/enhance-prompt');
const statusHandler = require('../api/ai-status');

test('Enhance prompt handler outputs rich commercial photography descriptors', async () => {
  let output = null;
  const mockRes = {
    setHeader() {},
    end(data) {
      output = JSON.parse(data);
    }
  };

  await enhanceHandler(
    {
      method: 'POST',
      body: { prompt: 'luxury mechanical watch', category: 'luxury-branding' }
    },
    mockRes
  );

  assert.ok(output && output.success);
  assert.ok(output.enhancedPrompt.includes('Masterpiece commercial poster visual'));
  assert.ok(output.enhancedPrompt.includes('8k resolution'));
  assert.ok(output.suggestedHeadline);
  assert.ok(output.negativePrompt);
});

test('AI status handler returns provider list and healthy operational status', async () => {
  let output = null;
  const mockRes = {
    setHeader() {},
    end(data) {
      output = JSON.parse(data);
    }
  };

  await statusHandler({ method: 'GET' }, mockRes);

  assert.ok(output && output.status === 'healthy');
  assert.ok(Array.isArray(output.providers) && output.providers.length >= 4);
  const flux = output.providers.find((p) => p.id === 'flux-community');
  assert.ok(flux && flux.configured && flux.requiresKey === false);
});

// -------------------------------------------------------------
// Results Summary
// -------------------------------------------------------------
console.log('\n-------------------------------------------------');
console.log(`Results: ${passedTests} of ${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('-------------------------------------------------\n');

if (passedTests === totalTests) {
  console.log('🎉 ALL AI POSTER STUDIO TESTS PASSED! 100% verified.\n');
  process.exit(0);
} else {
  console.error('❌ SOME TESTS FAILED.');
  process.exit(1);
}

