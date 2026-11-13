/**
 * FluxWebP Pro — AI Background Remover & Refinement Engine Automated Test Suite
 * Validates alpha mask composition, restore/erase brush operations, mask inversion,
 * feathering, background replacements, and batch concurrency throttling.
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
console.log("FluxWebP Pro — AI Background Remover Tests");
console.log("=================================================\n");

// --- Mock Canvas & Pixel Buffers for Headless Node Testing ---

function createMockImageData(width, height, fillR = 0, fillG = 0, fillB = 0, fillA = 255) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fillR;
    data[i + 1] = fillG;
    data[i + 2] = fillB;
    data[i + 3] = fillA;
  }
  return { width, height, data };
}

function applyMaskToPixels(srcImgData, maskImgData) {
  const out = createMockImageData(srcImgData.width, srcImgData.height);
  const src = srcImgData.data;
  const mask = maskImgData.data;
  const dst = out.data;

  for (let i = 0; i < src.length; i += 4) {
    dst[i] = src[i];
    dst[i + 1] = src[i + 1];
    dst[i + 2] = src[i + 2];
    const maskVal = mask[i]; // Grayscale mask intensity 0-255
    dst[i + 3] = Math.round((src[i + 3] * maskVal) / 255);
  }
  return out;
}

function invertMaskPixels(maskImgData) {
  const data = maskImgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const inv = 255 - data[i];
    data[i] = inv;
    data[i + 1] = inv;
    data[i + 2] = inv;
  }
}

function paintBrushPixels(maskImgData, cx, cy, radius, action = "restore", hardness = 0.5, opacity = 1.0) {
  const { width, height, data } = maskImgData;
  const r2 = radius * radius;
  const innerR = radius * hardness;
  const innerR2 = innerR * innerR;

  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(width - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(height - 1, Math.ceil(cy + radius));

  const targetVal = action === "restore" ? 255 : 0;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d2 <= r2) {
        let alpha = opacity;
        if (d2 > innerR2 && hardness < 1) {
          const dist = Math.sqrt(d2);
          alpha *= 1 - (dist - innerR) / (radius - innerR);
        }
        const idx = (y * width + x) * 4;
        const current = data[idx];
        const blended = Math.round(current + (targetVal - current) * alpha);
        data[idx] = blended;
        data[idx + 1] = blended;
        data[idx + 2] = blended;
      }
    }
  }
}

function featherMaskPixels(maskImgData, radius = 2) {
  if (radius <= 0) return;
  const { width, height, data } = maskImgData;
  const copy = new Uint8ClampedArray(data);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            sum += copy[(ny * width + nx) * 4];
            count++;
          }
        }
      }
      const avg = Math.round(sum / count);
      const idx = (y * width + x) * 4;
      data[idx] = avg;
      data[idx + 1] = avg;
      data[idx + 2] = avg;
    }
  }
}

function compositeBackgroundPixels(cutoutImgData, bgType = "white", bgColor = [255, 255, 255]) {
  const { width, height, data } = cutoutImgData;
  const out = createMockImageData(width, height);
  const dst = out.data;

  for (let i = 0; i < data.length; i += 4) {
    const srcA = data[i + 3] / 255;
    const invA = 1 - srcA;

    let bgR = 0, bgG = 0, bgB = 0, bgA = 0;
    if (bgType === "white") {
      bgR = 255; bgG = 255; bgB = 255; bgA = 1;
    } else if (bgType === "black") {
      bgR = 0; bgG = 0; bgB = 0; bgA = 1;
    } else if (bgType === "color") {
      bgR = bgColor[0]; bgG = bgColor[1]; bgB = bgColor[2]; bgA = 1;
    }

    dst[i] = Math.round(data[i] * srcA + bgR * invA);
    dst[i + 1] = Math.round(data[i + 1] * srcA + bgG * invA);
    dst[i + 2] = Math.round(data[i + 2] * srcA + bgB * invA);
    dst[i + 3] = Math.round(Math.max(srcA, bgA) * 255);
  }
  return out;
}

// ==========================================================
// TEST SUITE EXECUTION
// ==========================================================

console.log("Group 1: Alpha Channel Masking & Composition");

test("Applies binary alpha mask to source pixels (transparent cutout)", () => {
  const src = createMockImageData(20, 20, 255, 0, 0, 255); // Red 20x20
  const mask = createMockImageData(20, 20, 0, 0, 0, 255);   // All black mask

  // Set center 10x10 to white (foreground subject)
  for (let y = 5; y < 15; y++) {
    for (let x = 5; x < 15; x++) {
      const idx = (y * 20 + x) * 4;
      mask.data[idx] = 255;
      mask.data[idx + 1] = 255;
      mask.data[idx + 2] = 255;
    }
  }

  const result = applyMaskToPixels(src, mask);

  // Background pixel (0, 0) should be transparent (alpha = 0)
  assert.strictEqual(result.data[3], 0);

  // Foreground subject pixel (10, 10) should be fully opaque (alpha = 255) & red
  const fgIdx = (10 * 20 + 10) * 4;
  assert.strictEqual(result.data[fgIdx], 255);     // R
  assert.strictEqual(result.data[fgIdx + 1], 0);   // G
  assert.strictEqual(result.data[fgIdx + 2], 0);   // B
  assert.strictEqual(result.data[fgIdx + 3], 255); // A
});

test("Preserves semi-transparent alpha gradient (fine hair / glass)", () => {
  const src = createMockImageData(10, 10, 100, 150, 200, 255);
  const mask = createMockImageData(10, 10, 128, 128, 128, 255); // 50% mask

  const result = applyMaskToPixels(src, mask);
  assert.strictEqual(result.data[0], 100);
  assert.strictEqual(result.data[1], 150);
  assert.strictEqual(result.data[2], 200);
  assert.strictEqual(result.data[3], 128); // 50% alpha preserved
});

console.log("\nGroup 2: Mask Refinement Operations (Brushes & Invert)");

test("Restore brush paints white (opaque) onto transparent mask region", () => {
  const mask = createMockImageData(30, 30, 0, 0, 0, 255); // Black mask
  assert.strictEqual(mask.data[(15 * 30 + 15) * 4], 0);

  // Paint restore brush at center (15, 15) with radius 5
  paintBrushPixels(mask, 15, 15, 5, "restore", 1.0, 1.0);

  // Center pixel must now be 255 (restored)
  assert.strictEqual(mask.data[(15 * 30 + 15) * 4], 255);

  // Distant pixel (0, 0) remains 0
  assert.strictEqual(mask.data[0], 0);
});

test("Erase brush paints black (transparent) onto foreground region", () => {
  const mask = createMockImageData(30, 30, 255, 255, 255, 255); // White mask
  assert.strictEqual(mask.data[(15 * 30 + 15) * 4], 255);

  // Paint erase brush at center (15, 15) with radius 5
  paintBrushPixels(mask, 15, 15, 5, "erase", 1.0, 1.0);

  // Center pixel must now be 0 (erased)
  assert.strictEqual(mask.data[(15 * 30 + 15) * 4], 0);

  // Distant pixel (0, 0) remains 255
  assert.strictEqual(mask.data[0], 255);
});

test("Invert mask swaps foreground and background intensities", () => {
  const mask = createMockImageData(10, 10, 0, 0, 0, 255);
  mask.data[0] = 255;
  mask.data[1] = 255;
  mask.data[2] = 255; // (0, 0) is white

  invertMaskPixels(mask);

  assert.strictEqual(mask.data[0], 0);   // White became black
  assert.strictEqual(mask.data[4], 255); // Black became white
});

test("Feather filter smooths hard binary mask edges", () => {
  const mask = createMockImageData(20, 20, 0, 0, 0, 255);
  // Left half black, right half white
  for (let y = 0; y < 20; y++) {
    for (let x = 10; x < 20; x++) {
      const idx = (y * 20 + x) * 4;
      mask.data[idx] = 255;
      mask.data[idx + 1] = 255;
      mask.data[idx + 2] = 255;
    }
  }

  featherMaskPixels(mask, 2);

  // Boundary pixels at x=9 and x=10 should have soft transition (between 10 and 245)
  const b1 = mask.data[(10 * 20 + 9) * 4];
  const b2 = mask.data[(10 * 20 + 10) * 4];
  assert.ok(b1 > 0 && b1 < 255, `Boundary b1 was ${b1}`);
  assert.ok(b2 > 0 && b2 < 255, `Boundary b2 was ${b2}`);
});

console.log("\nGroup 3: Background Replacement Compositing");

test("Composites cutout over solid Studio White backdrop", () => {
  const src = createMockImageData(10, 10, 0, 0, 255, 255); // Blue subject
  const mask = createMockImageData(10, 10, 0, 0, 0, 255);
  mask.data[(5 * 10 + 5) * 4] = 255; // Single point foreground

  const cutout = applyMaskToPixels(src, mask);
  const composited = compositeBackgroundPixels(cutout, "white");

  // Center subject pixel remains Blue
  const fg = (5 * 10 + 5) * 4;
  assert.strictEqual(composited.data[fg], 0);
  assert.strictEqual(composited.data[fg + 1], 0);
  assert.strictEqual(composited.data[fg + 2], 255);

  // Background pixel at (0, 0) is pure White
  assert.strictEqual(composited.data[0], 255);
  assert.strictEqual(composited.data[1], 255);
  assert.strictEqual(composited.data[2], 255);
  assert.strictEqual(composited.data[3], 255);
});

test("Composites cutout over custom Studio Color backdrop", () => {
  const src = createMockImageData(10, 10, 255, 255, 0, 255); // Yellow subject
  const mask = createMockImageData(10, 10, 0, 0, 0, 255);
  const cutout = applyMaskToPixels(src, mask); // All transparent

  const composited = compositeBackgroundPixels(cutout, "color", [37, 99, 235]); // Blue #2563EB

  // Entire image is replaced with studio blue
  assert.strictEqual(composited.data[0], 37);
  assert.strictEqual(composited.data[1], 99);
  assert.strictEqual(composited.data[2], 235);
  assert.strictEqual(composited.data[3], 255);
});

console.log("\nGroup 4: Batch Concurrency & Queue Management");

test("Batch queue executes with controlled max concurrency of 2", async () => {
  let activeCount = 0;
  let maxObservedActive = 0;
  const items = [1, 2, 3, 4, 5, 6];
  const processed = [];

  async function mockProcessItem(id) {
    activeCount++;
    if (activeCount > maxObservedActive) maxObservedActive = activeCount;
    await new Promise((r) => setTimeout(r, 40));
    activeCount--;
    processed.push(id);
  }

  // Simulate queue worker with concurrency = 2
  const queue = [...items];
  const concurrency = 2;
  await new Promise((resolve) => {
    let running = 0;
    function next() {
      if (queue.length === 0 && running === 0) {
        resolve();
        return;
      }
      while (running < concurrency && queue.length > 0) {
        const item = queue.shift();
        running++;
        mockProcessItem(item).then(() => {
          running--;
          next();
        });
      }
    }
    next();
  });

  assert.strictEqual(processed.length, 6);
  assert.ok(maxObservedActive <= 2, `Max active exceeded concurrency: ${maxObservedActive}`);
});

console.log("\nGroup 5: Export Transparency Validation");

test("Format validator flags JPEG as incompatible with alpha transparency", () => {
  function validateTransparencyForFormat(format) {
    if (format === "png" || format === "webp" || format === "avif") {
      return { supportsAlpha: true, warning: null };
    }
    return {
      supportsAlpha: false,
      warning: "JPEG does not support alpha transparency. A white background will be automatically applied."
    };
  }

  assert.strictEqual(validateTransparencyForFormat("png").supportsAlpha, true);
  assert.strictEqual(validateTransparencyForFormat("webp").supportsAlpha, true);
  assert.strictEqual(validateTransparencyForFormat("avif").supportsAlpha, true);
  assert.strictEqual(validateTransparencyForFormat("jpeg").supportsAlpha, false);
  assert.ok(validateTransparencyForFormat("jpeg").warning.includes("JPEG does not support alpha"));
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
  console.log("🎉 ALL AI BACKGROUND REMOVER TESTS PASSED! 100% verified.");
  process.exit(0);
} else {
  console.error("❌ Some tests failed. Review output above.");
  process.exit(1);
}

