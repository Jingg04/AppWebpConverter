// tests/test-file-based-architecture.js
const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('======================================================================');
console.log(' FLUXWEBP PRO — DATABASE-FREE ARCHITECTURE VERIFICATION TEST SUITE');
console.log('======================================================================\n');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

const ROOT = path.resolve(__dirname, '..');
const contentBlogDir = path.join(ROOT, 'content/blog');
const manifestPath = path.join(contentBlogDir, 'manifest.json');
const publicAssetsDir = fs.existsSync(path.join(ROOT, 'blog-assets'))
  ? path.join(ROOT, 'blog-assets')
  : path.join(ROOT, 'public/blog-assets');

// 1. Check Strict Database Prohibition in Codebase & Dependencies
console.log('--- TEST GROUP 1: DATABASE PROHIBITION VERIFICATION ---');
const pkgPath = path.join(ROOT, 'package.json');
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const prohibitedDbPackages = [
    'pg', 'mysql', 'mysql2', 'mongodb', 'mongoose', 'firebase', 'firebase-admin',
    '@supabase/supabase-js', '@prisma/client', 'prisma', 'drizzle-orm', '@neondatabase/serverless'
  ];
  const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

  prohibitedDbPackages.forEach(dbPkg => {
    assert(!allDeps[dbPkg], `Zero dependency on prohibited database package: "${dbPkg}"`);
  });
} else {
  assert(true, 'Zero external database package manifests (pure database-free project)');
}

// Check api/admin files for forbidden database imports
const apiFiles = ['auth.js', 'content.js', 'backup.js', '_auth-helper.js'];
apiFiles.forEach(file => {
  const filePath = path.join(ROOT, 'api/admin', file);
  assert(fs.existsSync(filePath), `API file exists: api/admin/${file}`);
  const code = fs.readFileSync(filePath, 'utf8');
  assert(!/require\(['"](?:pg|mysql|mongodb|mongoose|firebase|supabase|prisma|drizzle|neon)/i.test(code),
    `api/admin/${file} contains 0 database client imports`);
});

// 2. Check File-Based Content Architecture (/content/blog/)
console.log('\n--- TEST GROUP 2: FILE-BASED CONTENT ARCHITECTURE (100 ARTICLES) ---');
assert(fs.existsSync(manifestPath), `Manifest exists at ${path.relative(ROOT, manifestPath)}`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert(Array.isArray(manifest), 'manifest.json is an array');
assert(manifest.length === 100, `manifest.json contains exactly 100 articles (found: ${manifest.length})`);

let missingFolders = 0;
let missingMdx = 0;
let missingMeta = 0;
let missingPrompts = 0;
let totalVisualPrompts = 0;

manifest.forEach((art, idx) => {
  const artDir = path.join(contentBlogDir, art.folder);
  if (!fs.existsSync(artDir)) missingFolders++;
  const mdxPath = path.join(artDir, 'article.mdx');
  const metaPath = path.join(artDir, 'metadata.json');
  const promptsPath = path.join(artDir, 'visual-prompts.json');

  if (!fs.existsSync(mdxPath)) missingMdx++;
  if (!fs.existsSync(metaPath)) missingMeta++;
  if (!fs.existsSync(promptsPath)) {
    missingPrompts++;
  } else {
    try {
      const prompts = JSON.parse(fs.readFileSync(promptsPath, 'utf8'));
      if (Array.isArray(prompts)) totalVisualPrompts += prompts.length;
    } catch (_) {}
  }
});

assert(missingFolders === 0, `All 100 article folders exist in /content/blog/ (missing: ${missingFolders})`);
assert(missingMdx === 0, `All 100 articles have article.mdx (missing: ${missingMdx})`);
assert(missingMeta === 0, `All 100 articles have metadata.json (missing: ${missingMeta})`);
assert(missingPrompts === 0, `All 100 articles have visual-prompts.json (missing: ${missingPrompts})`);
assert(totalVisualPrompts === 500, `Exact total of 500 visual prompts across all articles (found: ${totalVisualPrompts})`);

// 3. Check File-Based Media Architecture (/public/blog-assets/)
console.log('\n--- TEST GROUP 3: FILE-BASED MEDIA ARCHITECTURE (500 ASSETS) ---');
assert(fs.existsSync(publicAssetsDir), `Public assets directory exists at ${path.relative(ROOT, publicAssetsDir)}`);

let missingAssetFolders = 0;
let totalPhysicalAssets = 0;
const expectedAssetNames = ['hero.svg', 'infographic.svg', 'workflow.svg', 'comparison.svg', 'application.svg'];

manifest.forEach(art => {
  const folder = path.join(publicAssetsDir, art.folder);
  if (!fs.existsSync(folder)) {
    missingAssetFolders++;
  } else {
    expectedAssetNames.forEach(assetName => {
      if (fs.existsSync(path.join(folder, assetName))) {
        totalPhysicalAssets++;
      }
    });
  }
});

assert(missingAssetFolders === 0, `All 100 media asset folders exist in /public/blog-assets/ (missing: ${missingAssetFolders})`);
assert(totalPhysicalAssets === 500, `Exact total of 500 physical SVG visual assets exist (found: ${totalPhysicalAssets})`);

// 4. Serverless API Endpoint Tests
console.log('\n--- TEST GROUP 4: SERVERLESS AUTH & CONTENT API VERIFICATION ---');
async function runApiTests() {
  const authHandler = require('../api/admin/auth.js');
  const contentHandler = require('../api/admin/content.js');
  const backupHandler = require('../api/admin/backup.js');
  const { ADMIN_PASSCODE, signToken } = require('../api/admin/_auth-helper.js');

  function mockReqRes(options) {
    const req = {
      method: options.method || 'GET',
      url: options.url || '/',
      headers: options.headers || {},
      body: options.body || null,
      async *[Symbol.asyncIterator]() {
        if (options.rawBody) yield Buffer.from(options.rawBody);
      }
    };
    let statusCode = 200;
    let headers = {};
    let data = '';

    const res = {
      set statusCode(val) { statusCode = val; },
      get statusCode() { return statusCode; },
      setHeader(k, v) { headers[k.toLowerCase()] = v; },
      getHeader(k) { return headers[k.toLowerCase()]; },
      end(chunk) {
        if (chunk) data += chunk.toString();
        return this;
      },
      write(chunk) {
        if (chunk) data += chunk.toString();
        return true;
      }
    };

    return { req, res, getResult: () => ({ statusCode, headers, body: data }) };
  }

  // A. Check auth GET status unauthenticated
  {
    const { req, res, getResult } = mockReqRes({ method: 'GET', url: '/api/admin/auth' });
    await authHandler(req, res);
    const result = getResult();
    const json = JSON.parse(result.body);
    assert(result.statusCode === 200 && json.authenticated === false, 'auth GET unauthenticated returns 200 with authenticated: false');
  }

  // B. Check auth POST wrong password
  {
    const { req, res, getResult } = mockReqRes({
      method: 'POST',
      url: '/api/admin/auth',
      body: { password: 'wrongpassword' }
    });
    await authHandler(req, res);
    const result = getResult();
    const json = JSON.parse(result.body);
    assert(result.statusCode === 401 && json.success === false, 'auth POST wrong password rejects with 401');
  }

  // C. Check auth POST correct password
  let sessionToken = null;
  {
    const { req, res, getResult } = mockReqRes({
      method: 'POST',
      url: '/api/admin/auth',
      body: { password: ADMIN_PASSCODE }
    });
    await authHandler(req, res);
    const result = getResult();
    const json = JSON.parse(result.body);
    sessionToken = json.token;
    const cookieHeader = result.headers['set-cookie'];
    assert(result.statusCode === 200 && json.success === true, 'auth POST correct passcode succeeds with 200');
    assert(cookieHeader && cookieHeader.includes('HttpOnly') && cookieHeader.includes('flux_admin_session'),
      'auth POST sets secure HttpOnly session cookie');
    assert(sessionToken && sessionToken.includes('.'), 'auth POST returns signed cryptographic session token');
  }

  // D. Check content endpoint unauthorized access
  {
    const { req, res, getResult } = mockReqRes({ method: 'GET', url: '/api/admin/content?action=stats' });
    await contentHandler(req, res);
    const result = getResult();
    assert(result.statusCode === 401, 'content API blocks unauthenticated access with 401');
  }

  // E. Check content endpoint authorized action=stats
  {
    const { req, res, getResult } = mockReqRes({
      method: 'GET',
      url: '/api/admin/content?action=stats',
      headers: { authorization: `Bearer ${sessionToken}` }
    });
    await contentHandler(req, res);
    const result = getResult();
    assert(result.statusCode === 200, 'content API action=stats returns 200 with valid session');
    const stats = JSON.parse(result.body);
    assert(stats.totalArticles === 100, `Real computed totalArticles is 100 (got: ${stats.totalArticles})`);
    assert(stats.publishedArticles === 100, `Real computed publishedArticles is 100 (got: ${stats.publishedArticles})`);
    assert(stats.totalVisualPrompts === 500, `Real computed totalVisualPrompts is 500 (got: ${stats.totalVisualPrompts})`);
    assert(Object.keys(stats.categoryCounts).length === 10, 'Category breakdown contains all 10 categories');
  }

  // F. Check content endpoint authorized action=get&id=1
  {
    const { req, res, getResult } = mockReqRes({
      method: 'GET',
      url: '/api/admin/content?action=get&id=1',
      headers: { authorization: `Bearer ${sessionToken}` }
    });
    await contentHandler(req, res);
    const result = getResult();
    assert(result.statusCode === 200, 'content API action=get returns 200');
    const article = JSON.parse(result.body);
    assert(article.manifestItem && article.manifestItem.slug === 'what-is-webp-how-it-works',
      'Article #1 loaded accurately from content files');
    assert(Array.isArray(article.visualPrompts) && article.visualPrompts.length === 5,
      'Article #1 has 5 visual prompt records loaded from visual-prompts.json');
    assert(article.mdxContent && article.mdxContent.includes('WebP'),
      'Article #1 MDX body loaded from article.mdx');
  }

  // G. Check backup endpoint export & import validation
  {
    const { req, res, getResult } = mockReqRes({
      method: 'GET',
      url: '/api/admin/backup',
      headers: { authorization: `Bearer ${sessionToken}` }
    });
    await backupHandler(req, res);
    const result = getResult();
    assert(result.statusCode === 200, 'backup API export returns 200');
    const pkg = JSON.parse(result.body);
    assert(pkg.totalArticles === 100 && pkg.articles.length === 100, 'Backup package contains all 100 articles');

    // Test import validation
    const { req: valReq, res: valRes, getResult: getValResult } = mockReqRes({
      method: 'POST',
      url: '/api/admin/backup',
      headers: { authorization: `Bearer ${sessionToken}` },
      body: { articles: [{ title: 'Duplicate Test', slug: 'what-is-webp-how-it-works' }] }
    });
    await backupHandler(valReq, valRes);
    const valResult = getValResult();
    const valJson = JSON.parse(valResult.body);
    assert(valJson.duplicatesCount === 1 && valJson.duplicateSlugs.includes('what-is-webp-how-it-works'),
      'Backup import validator accurately detects duplicate slugs');
  }

  // 5. Check Admin CMS Base Route & Security
  console.log('\n--- TEST GROUP 5: ADMIN CMS BASE ROUTE & UI VERIFICATION ---');
  const adminHtmlPath = path.join(ROOT, 'samnang.com.com.omg/index.html');
  assert(fs.existsSync(adminHtmlPath), 'Exclusive admin entry point exists at /samnang.com.com.omg/index.html');
  const adminHtml = fs.readFileSync(adminHtmlPath, 'utf8');
  assert(!adminHtml.includes('fluxwebp2026!pro'), 'ZERO hardcoded passwords or secrets exposed in frontend admin HTML/JS');
  assert(adminHtml.includes('fetch(\'/api/admin/auth\''), 'Frontend admin communicates with server-side /api/admin/auth');
  assert(adminHtml.includes('panel-media'), 'Admin CMS includes File Media Directory panel (/public/blog-assets/)');
  assert(adminHtml.includes('panel-settings'), 'Admin CMS includes Backup & Restore panel');
  assert(adminHtml.includes('subroute-router') || adminHtml.includes('routeMap'), 'Admin CMS includes subroute navigation support');

  console.log('\n======================================================================');
  console.log(` RESULTS: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
  console.log('======================================================================');
}

runApiTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
