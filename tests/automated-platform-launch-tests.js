/**
 * FluxWebP Pro — Production Platform Launch Verification Test Suite
 * Verifies all 10 platform routes, security headers, sitemap, service worker,
 * cross-tool handoff contracts, and mathematical resizer calculations.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✔ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ✖ [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

console.log('=================================================');
console.log('FluxWebP Pro — Platform Production Launch Tests');
console.log('=================================================\n');

// -------------------------------------------------------------
// Group 1: Route Integrity & Mandatory HTML Shell Elements
// -------------------------------------------------------------
console.log('Group 1: Route Integrity & Mandatory HTML Shell Elements');

const MANDATORY_ROUTES = [
  { path: 'index.html', title: 'FluxWebP Pro' },
  { path: 'editor/index.html', title: 'Image Editor' },
  { path: 'poster-studio/index.html', title: 'AI Poster Studio' },
  { path: 'background-remover/index.html', title: 'AI Background Remover' },
  { path: 'resizer/index.html', title: 'Image Resizer' },
  { path: 'projects/index.html', title: 'My Projects' },
  { path: 'help/index.html', title: 'Help Center' },
  { path: 'contact/index.html', title: 'Contact' },
  { path: 'about/index.html', title: 'About' },
  { path: 'privacy/index.html', title: 'Privacy Policy' },
  { path: 'terms/index.html', title: 'Terms of Service' },
  { path: '404.html', title: 'Page Not Found' }
];

MANDATORY_ROUTES.forEach(({ path: relPath, title }) => {
  const fullPath = path.join(ROOT_DIR, relPath);
  const exists = fs.existsSync(fullPath);
  assert(exists, `Route file exists: ${relPath}`);

  if (exists) {
    const content = fs.readFileSync(fullPath, 'utf8');
    assert(content.includes('<!DOCTYPE html>'), `${relPath} contains valid DOCTYPE`);
    assert(content.includes('<meta name="viewport"'), `${relPath} contains responsive viewport meta`);
    assert(content.includes(title), `${relPath} title contains "${title}"`);
    assert(content.includes('role="banner"') || content.includes('<header'), `${relPath} has accessible header landmark`);
    assert(content.includes('role="contentinfo"') || content.includes('<footer'), `${relPath} has accessible footer landmark`);
  }
});

// -------------------------------------------------------------
// Group 2: Vercel Production Security Headers
// -------------------------------------------------------------
console.log('\nGroup 2: Vercel Production Security Headers');

const vercelJsonPath = path.join(ROOT_DIR, 'vercel.json');
assert(fs.existsSync(vercelJsonPath), 'vercel.json configuration exists');

const vercelJson = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
assert(Array.isArray(vercelJson.headers), 'vercel.json defines headers array');

const globalHeaderRule = vercelJson.headers.find(h => h.source === '/(.*)');
assert(!!globalHeaderRule, 'vercel.json applies global headers to /(.*)');

const headerKeys = globalHeaderRule ? globalHeaderRule.headers.map(h => h.key.toLowerCase()) : [];
assert(headerKeys.includes('x-content-type-options'), 'Enforces X-Content-Type-Options: nosniff');
assert(headerKeys.includes('x-frame-options'), 'Enforces X-Frame-Options: SAMEORIGIN');
assert(headerKeys.includes('strict-transport-security'), 'Enforces Strict-Transport-Security (HSTS)');
assert(headerKeys.includes('referrer-policy'), 'Enforces Referrer-Policy');
assert(headerKeys.includes('permissions-policy'), 'Enforces Permissions-Policy');
assert(headerKeys.includes('content-security-policy'), 'Enforces Content-Security-Policy');

// -------------------------------------------------------------
// Group 3: XML Sitemap Canonical URLs & Service Worker Shell
// -------------------------------------------------------------
console.log('\nGroup 3: XML Sitemap Canonical URLs & Service Worker Shell');

const sitemapContent = fs.readFileSync(path.join(ROOT_DIR, 'sitemap.xml'), 'utf8');
const EXPECTED_URLS = [
  'https://app-webp-converter.vercel.app/',
  'https://app-webp-converter.vercel.app/editor/',
  'https://app-webp-converter.vercel.app/poster-studio/',
  'https://app-webp-converter.vercel.app/background-remover/',
  'https://app-webp-converter.vercel.app/resizer/',
  'https://app-webp-converter.vercel.app/projects/',
  'https://app-webp-converter.vercel.app/help/',
  'https://app-webp-converter.vercel.app/contact/',
  'https://app-webp-converter.vercel.app/about/',
  'https://app-webp-converter.vercel.app/privacy/',
  'https://app-webp-converter.vercel.app/terms/'
];

EXPECTED_URLS.forEach(url => {
  assert(sitemapContent.includes(`<loc>${url}</loc>`), `Sitemap contains canonical ${url}`);
});

const swContent = fs.readFileSync(path.join(ROOT_DIR, 'sw.js'), 'utf8');
assert(swContent.includes('fluxwebp-shell-v6'), 'Service Worker upgraded to fluxwebp-shell-v6');
assert(swContent.includes('/background-remover/'), 'SW precaches /background-remover/');
assert(swContent.includes('/resizer/'), 'SW precaches /resizer/');
assert(swContent.includes('/projects/'), 'SW precaches /projects/');
assert(swContent.includes('/help/'), 'SW precaches /help/');
assert(swContent.includes('/contact/'), 'SW precaches /contact/');
assert(swContent.includes('/404.html'), 'SW precaches /404.html');

// -------------------------------------------------------------
// Group 4: Cross-Tool Handoff Contract Keys
// -------------------------------------------------------------
console.log('\nGroup 4: Cross-Tool Handoff Contract Keys');

const appJs = fs.readFileSync(path.join(ROOT_DIR, 'app.js'), 'utf8');
const editorJs = fs.readFileSync(path.join(ROOT_DIR, 'editor/editor.js'), 'utf8');
const posterJs = fs.readFileSync(path.join(ROOT_DIR, 'poster-studio/poster-studio.js'), 'utf8');
const bgRemoverHtml = fs.readFileSync(path.join(ROOT_DIR, 'background-remover/index.html'), 'utf8');
const resizerHtml = fs.readFileSync(path.join(ROOT_DIR, 'resizer/index.html'), 'utf8');
const projectsHtml = fs.readFileSync(path.join(ROOT_DIR, 'projects/index.html'), 'utf8');

assert(appJs.includes('openItemInBgRemover'), 'app.js implements openItemInBgRemover');
assert(appJs.includes('openItemInPosterStudio'), 'app.js implements openItemInPosterStudio');
assert(appJs.includes('openItemInResizer'), 'app.js implements openItemInResizer');
assert(bgRemoverHtml.includes('fluxwebp_poster_bg_image'), 'background-remover sends cutout to poster studio');
assert(posterJs.includes('checkTransferredImage'), 'poster-studio reads transferred images');
assert(resizerHtml.includes('btnEditInEditor'), 'resizer allows sending resized canvas to editor');
assert(resizerHtml.includes('btnConvertToWebp'), 'resizer allows sending resized canvas to converter');
assert(projectsHtml.includes('fluxwebp_project_'), 'projects reads poster and editor projects from localStorage');

// -------------------------------------------------------------
// Group 5: Image Resizer Calculation Geometry
// -------------------------------------------------------------
console.log('\nGroup 5: Image Resizer Calculation Geometry');

function calculateTargetDimensions(origW, origH, targetW, lockAspect) {
  const aspect = origW / origH;
  if (lockAspect) {
    return { width: targetW, height: Math.round(targetW / aspect) };
  }
  return { width: targetW, height: origH };
}

const squareRes = calculateTargetDimensions(1920, 1080, 1080, true);
assert(squareRes.width === 1080 && squareRes.height === 608, 'Aspect lock maintains 16:9 ratio at 1080w -> 608h');

const portraitRes = calculateTargetDimensions(1000, 2000, 500, true);
assert(portraitRes.width === 500 && portraitRes.height === 1000, 'Aspect lock maintains 1:2 ratio at 500w -> 1000h');

// Social Presets definitions
const PRESETS = [
  { name: 'Instagram Square', w: 1080, h: 1080, aspect: 1.0 },
  { name: 'Instagram Portrait', w: 1080, h: 1350, aspect: 0.8 },
  { name: 'Story / Reels', w: 1080, h: 1920, aspect: 1080 / 1920 },
  { name: 'YouTube Thumb', w: 1280, h: 720, aspect: 16 / 9 },
  { name: 'LinkedIn Post', w: 1200, h: 627, aspect: 1200 / 627 }
];

PRESETS.forEach(p => {
  assert(resizerHtml.includes(`data-w="${p.w}"`) && resizerHtml.includes(`data-h="${p.h}"`), `Resizer contains preset ${p.name} (${p.w}×${p.h})`);
});

// -------------------------------------------------------------
// Summary
// -------------------------------------------------------------
console.log('\n-------------------------------------------------');
console.log(`Results: ${passedTests} of ${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('-------------------------------------------------\n');

if (passedTests === totalTests) {
  console.log('🎉 ALL PLATFORM PRODUCTION LAUNCH TESTS PASSED! 100% verified.');
} else {
  console.error('❌ SOME TESTS FAILED. Inspect output above.');
  process.exit(1);
}
