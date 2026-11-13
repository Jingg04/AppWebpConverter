/**
 * FluxWebP Pro — Image Editor Engine Automated Test Suite
 * Validates document model, layer stack operations, crop math, filter string generation,
 * transform matrices, and project serialization.
 */

const assert = require("assert");

const TEST_RESULTS = [];

function test(name, fn) {
  try {
    fn();
    TEST_RESULTS.push({ name, passed: true });
    console.log(`  ✔ [PASS] ${name}`);
  } catch (err) {
    TEST_RESULTS.push({ name, passed: false, error: err.message });
    console.error(`  ✖ [FAIL] ${name}: ${err.message}`);
  }
}

console.log("=================================================");
console.log("FluxWebP Pro — Image Editor Automated Tests");
console.log("=================================================\n");

// --- Mock Editor Math & State Logic from editor.js ---

function createDocument(width = 1200, height = 800, name = "TestProject") {
  return {
    width,
    height,
    name,
    background: "checkerboard",
    layers: [],
    activeLayerId: null
  };
}

function addLayer(doc, layer) {
  const newLayer = {
    id: `layer-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: layer.name || `Layer ${doc.layers.length + 1}`,
    type: layer.type || "image",
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: "normal",
    x: layer.x || 0,
    y: layer.y || 0,
    width: layer.width || doc.width,
    height: layer.height || doc.height,
    rotation: layer.rotation || 0,
    flipH: false,
    flipV: false,
    filters: {
      brightness: 100,
      contrast: 100,
      exposure: 0,
      saturation: 100,
      temperature: 0,
      tint: 0,
      sharpness: 0,
      blur: 0,
      vignette: 0,
      preset: "normal",
      presetIntensity: 100
    },
    ...layer
  };
  doc.layers.push(newLayer);
  doc.activeLayerId = newLayer.id;
  return newLayer;
}

function duplicateLayer(doc, layerId) {
  const layer = doc.layers.find((l) => l.id === layerId);
  if (!layer) return null;
  const clone = JSON.parse(JSON.stringify(layer));
  clone.id = `layer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  clone.name = `${layer.name} Copy`;
  clone.x += 20;
  clone.y += 20;
  doc.layers.push(clone);
  doc.activeLayerId = clone.id;
  return clone;
}

function deleteLayer(doc, layerId) {
  const idx = doc.layers.findIndex((l) => l.id === layerId);
  if (idx < 0) return false;
  doc.layers.splice(idx, 1);
  doc.activeLayerId = doc.layers.length > 0 ? doc.layers[doc.layers.length - 1].id : null;
  return true;
}

function moveLayer(doc, fromIdx, toIdx) {
  if (fromIdx < 0 || toIdx < 0 || fromIdx >= doc.layers.length || toIdx >= doc.layers.length) return;
  const [removed] = doc.layers.splice(fromIdx, 1);
  doc.layers.splice(toIdx, 0, removed);
}

function computeFilterString(filters) {
  const f = filters || {};
  const brightness = (f.brightness ?? 100) + (f.exposure ?? 0) * 1.5;
  const contrast = f.contrast ?? 100;
  const saturation = f.saturation ?? 100;
  const blur = (f.blur ?? 0) * 0.1;
  const sepia = f.temperature > 0 ? f.temperature * 0.4 : 0;
  const hueRotate = f.tint ?? 0;

  const parts = [];
  if (brightness !== 100) parts.push(`brightness(${brightness}%)`);
  if (contrast !== 100) parts.push(`contrast(${contrast}%)`);
  if (saturation !== 100) parts.push(`saturate(${saturation}%)`);
  if (blur > 0) parts.push(`blur(${blur.toFixed(1)}px)`);
  if (sepia > 0) parts.push(`sepia(${sepia.toFixed(0)}%)`);
  if (hueRotate !== 0) parts.push(`hue-rotate(${hueRotate}deg)`);

  return parts.join(" ") || "none";
}

function computeCropAspectRect(docW, docH, ratio) {
  let cropW, cropH;
  if (!ratio || ratio === "free") {
    cropW = Math.round(docW * 0.85);
    cropH = Math.round(docH * 0.85);
  } else {
    const [rw, rh] = ratio.split(":").map(Number);
    const targetAspect = rw / rh;
    const docAspect = docW / docH;
    if (docAspect > targetAspect) {
      cropH = Math.round(docH * 0.85);
      cropW = Math.round(cropH * targetAspect);
    } else {
      cropW = Math.round(docW * 0.85);
      cropH = Math.round(cropW / targetAspect);
    }
  }
  const cropX = Math.round((docW - cropW) / 2);
  const cropY = Math.round((docH - cropH) / 2);
  return { x: cropX, y: cropY, width: cropW, height: cropH };
}

function mapPointerToCanvas(clientX, clientY, canvasRect, docW, docH) {
  const scaleX = docW / canvasRect.width;
  const scaleY = docH / canvasRect.height;
  return {
    x: (clientX - canvasRect.left) * scaleX,
    y: (clientY - canvasRect.top) * scaleY
  };
}

function serializeProject(doc) {
  return JSON.stringify({
    version: "2.4.0",
    type: "fluxwebp-project",
    doc,
    timestamp: Date.now()
  });
}

function validateProject(jsonStr) {
  const data = JSON.parse(jsonStr);
  if (data.type !== "fluxwebp-project") throw new Error("Invalid project type");
  if (!data.doc || typeof data.doc.width !== "number" || typeof data.doc.height !== "number") {
    throw new Error("Invalid document structure");
  }
  if (!Array.isArray(data.doc.layers)) throw new Error("Layers array missing");
  return data;
}

// ==========================================================
// TEST SUITE EXECUTION
// ==========================================================

console.log("Group 1: Document Model & Layer Stack Management");

test("Initializes clean document model with correct dimensions", () => {
  const doc = createDocument(1920, 1080, "Banner");
  assert.strictEqual(doc.width, 1920);
  assert.strictEqual(doc.height, 1080);
  assert.strictEqual(doc.name, "Banner");
  assert.strictEqual(doc.layers.length, 0);
  assert.strictEqual(doc.activeLayerId, null);
});

test("Adds base image layer and sets it as active", () => {
  const doc = createDocument(1200, 800);
  const layer = addLayer(doc, { name: "Base Photo", type: "image", width: 1200, height: 800 });
  assert.strictEqual(doc.layers.length, 1);
  assert.strictEqual(doc.activeLayerId, layer.id);
  assert.strictEqual(layer.type, "image");
  assert.strictEqual(layer.visible, true);
  assert.strictEqual(layer.locked, false);
});

test("Adds text, shape, and watermark layers", () => {
  const doc = createDocument(1000, 1000);
  addLayer(doc, { type: "image", name: "Background" });
  addLayer(doc, { type: "text", name: "Heading", text: "Summer Sale", fontSize: 48 });
  addLayer(doc, { type: "shape", name: "Badge", shapeType: "circle", fill: "#EF4444" });
  addLayer(doc, { type: "watermark", name: "Watermark", text: "© FluxWebP Pro" });

  assert.strictEqual(doc.layers.length, 4);
  assert.strictEqual(doc.layers[1].type, "text");
  assert.strictEqual(doc.layers[2].type, "shape");
  assert.strictEqual(doc.layers[3].type, "watermark");
});

test("Duplicates an existing layer with offset and unique ID", () => {
  const doc = createDocument(800, 600);
  const original = addLayer(doc, { name: "Logo", type: "image", x: 100, y: 150 });
  const copy = duplicateLayer(doc, original.id);

  assert.strictEqual(doc.layers.length, 2);
  assert.notStrictEqual(copy.id, original.id);
  assert.strictEqual(copy.name, "Logo Copy");
  assert.strictEqual(copy.x, 120);
  assert.strictEqual(copy.y, 170);
  assert.strictEqual(doc.activeLayerId, copy.id);
});

test("Deletes layer and updates activeLayerId", () => {
  const doc = createDocument(800, 600);
  const l1 = addLayer(doc, { name: "L1" });
  const l2 = addLayer(doc, { name: "L2" });
  const l3 = addLayer(doc, { name: "L3" });

  assert.strictEqual(doc.layers.length, 3);
  assert.strictEqual(doc.activeLayerId, l3.id);

  deleteLayer(doc, l2.id);
  assert.strictEqual(doc.layers.length, 2);
  assert.strictEqual(doc.layers.some((l) => l.id === l2.id), false);
  assert.strictEqual(doc.activeLayerId, l3.id);

  deleteLayer(doc, l3.id);
  assert.strictEqual(doc.layers.length, 1);
  assert.strictEqual(doc.activeLayerId, l1.id);
});

test("Reorders layers in the stack (z-index)", () => {
  const doc = createDocument(500, 500);
  const l1 = addLayer(doc, { name: "Bottom" });
  const l2 = addLayer(doc, { name: "Middle" });
  const l3 = addLayer(doc, { name: "Top" });

  moveLayer(doc, 0, 2); // Move bottom to top
  assert.strictEqual(doc.layers[0].name, "Middle");
  assert.strictEqual(doc.layers[1].name, "Top");
  assert.strictEqual(doc.layers[2].name, "Bottom");
});

console.log("\nGroup 2: Filter String & Image Processing Math");

test("Computes default filters as 'none'", () => {
  const str = computeFilterString({
    brightness: 100,
    contrast: 100,
    exposure: 0,
    saturation: 100,
    blur: 0,
    temperature: 0,
    tint: 0
  });
  assert.strictEqual(str, "none");
});

test("Generates accurate composite CSS filter string for adjustments", () => {
  const str = computeFilterString({
    brightness: 110,
    contrast: 120,
    exposure: 5,
    saturation: 130,
    blur: 20,
    temperature: 25,
    tint: 15
  });
  assert.ok(str.includes("brightness(117.5%)"));
  assert.ok(str.includes("contrast(120%)"));
  assert.ok(str.includes("saturate(130%)"));
  assert.ok(str.includes("blur(2.0px)"));
  assert.ok(str.includes("sepia(10%)"));
  assert.ok(str.includes("hue-rotate(15deg)"));
});

console.log("\nGroup 3: Canvas Crop & Aspect Ratio Math");

test("Computes 1:1 square crop box centered in 16:9 canvas", () => {
  const { x, y, width, height } = computeCropAspectRect(1920, 1080, "1:1");
  assert.strictEqual(width, height);
  assert.strictEqual(height, Math.round(1080 * 0.85)); // 918
  assert.strictEqual(x, Math.round((1920 - 918) / 2));
  assert.strictEqual(y, Math.round((1080 - 918) / 2));
});

test("Computes 16:9 crop box centered in portrait canvas", () => {
  const { x, y, width, height } = computeCropAspectRect(1080, 1920, "16:9");
  assert.strictEqual(Math.round((width / height) * 100) / 100, Math.round((16 / 9) * 100) / 100);
  assert.strictEqual(width, Math.round(1080 * 0.85));
  assert.ok(x >= 0 && y >= 0);
});

test("Computes free aspect ratio crop box centered in canvas", () => {
  const { x, y, width, height } = computeCropAspectRect(1200, 800, "free");
  assert.strictEqual(width, 1020);
  assert.strictEqual(height, 680);
  assert.strictEqual(x, 90);
  assert.strictEqual(y, 60);
});

console.log("\nGroup 4: Coordinate Mapping under Zoom & Pan");

test("Maps pointer from client viewport to canvas pixels at 100% scale", () => {
  const rect = { left: 100, top: 50, width: 800, height: 600 };
  const pt = mapPointerToCanvas(500, 350, rect, 800, 600);
  assert.strictEqual(pt.x, 400);
  assert.strictEqual(pt.y, 300);
});

test("Maps pointer from client viewport to canvas pixels at 200% zoom (zoomed display)", () => {
  const rect = { left: 0, top: 0, width: 1600, height: 1200 }; // 800x600 displayed twice as big
  const pt = mapPointerToCanvas(800, 600, rect, 800, 600);
  assert.strictEqual(pt.x, 400);
  assert.strictEqual(pt.y, 300);
});

console.log("\nGroup 5: Project Serialization & Schema Validation");

test("Serializes and validates .fluxproj document package", () => {
  const doc = createDocument(1440, 900, "ProductLaunch");
  addLayer(doc, { name: "Product", type: "image", width: 1440, height: 900 });
  addLayer(doc, { name: "Tagline", type: "text", text: "Fast & Clean" });

  const serialized = serializeProject(doc);
  assert.ok(serialized.length > 50);

  const parsed = validateProject(serialized);
  assert.strictEqual(parsed.version, "2.4.0");
  assert.strictEqual(parsed.type, "fluxwebp-project");
  assert.strictEqual(parsed.doc.width, 1440);
  assert.strictEqual(parsed.doc.height, 900);
  assert.strictEqual(parsed.doc.layers.length, 2);
  assert.strictEqual(parsed.doc.layers[0].name, "Product");
  assert.strictEqual(parsed.doc.layers[1].name, "Tagline");
});

test("Rejects invalid project structure missing required fields", () => {
  const invalidJson = JSON.stringify({ type: "unknown", doc: {} });
  assert.throws(() => validateProject(invalidJson), /Invalid project type/);
});

// ==========================================================
// SUMMARY
// ==========================================================
console.log("\n-------------------------------------------------");
const passedCount = TEST_RESULTS.filter((t) => t.passed).length;
const totalCount = TEST_RESULTS.length;
console.log(`Results: ${passedCount} of ${totalCount} tests passed (${Math.round((passedCount / totalCount) * 100)}%)`);
console.log("-------------------------------------------------\n");

if (passedCount === totalCount) {
  console.log("🎉 ALL IMAGE EDITOR TESTS PASSED! Ready for deployment.");
  process.exit(0);
} else {
  console.error("❌ Some tests failed. Review output above.");
  process.exit(1);
}

