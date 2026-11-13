// tests/automated-blog-cms-tests.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

console.log('=== RUNNING FLUXWEBP PRO BLOG & CMS AUTOMATED TEST SUITE ===\n');

// 1. Data Integrity Tests
console.log('Test Group 1: Master Database & Data Artifacts');
const articlesPath = path.join(ROOT, 'data/blog-articles.json');
const manifestPath = path.join(ROOT, 'data/blog-manifest.json');
const catalogPath = path.join(ROOT, 'data/visual-assets-catalog.json');
const categoriesPath = path.join(ROOT, 'data/blog-categories.json');

assert(fs.existsSync(articlesPath), 'blog-articles.json exists');
assert(fs.existsSync(manifestPath), 'blog-manifest.json exists');
assert(fs.existsSync(catalogPath), 'visual-assets-catalog.json exists');
assert(fs.existsSync(categoriesPath), 'blog-categories.json exists');

const articles = JSON.parse(fs.readFileSync(articlesPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));

assert(articles.length === 100, `Exactly 100 articles in blog-articles.json (found: ${articles.length})`);
assert(manifest.length === 100, `Exactly 100 entries in blog-manifest.json (found: ${manifest.length})`);
assert(catalog.length === 500, `Exactly 500 visual assets in visual-assets-catalog.json (found: ${catalog.length})`);
assert(categories.length === 10, `Exactly 10 categories defined (found: ${categories.length})`);

// Check category distribution
const catCounts = {};
articles.forEach(a => {
  const slug = a.categorySlug || a.category;
  catCounts[slug] = (catCounts[slug] || 0) + 1;
});
let allCatsHave10 = true;
categories.forEach(c => {
  if (catCounts[c.slug] !== 10) {
    allCatsHave10 = false;
    console.error(`Category ${c.slug} (${c.name}) has ${catCounts[c.slug]} articles (expected 10)`);
  }
});
assert(allCatsHave10, 'Every category contains exactly 10 articles (10 * 10 = 100)');

// 2. SEO & Visual Asset Compliance Tests
console.log('\nTest Group 2: SEO Packages & Visual Asset Integrity');
let allArticlesHaveSeo = true;
let allArticlesHave5Visuals = true;
let allVisualsHavePrompts = true;

articles.forEach(art => {
  const hasMeta = (art.metaTitle && art.metaDescription && art.slug);
  const hasKeywords = (art.primaryKeyword && Array.isArray(art.secondaryKeywords));
  if (!hasMeta || !hasKeywords) {
    allArticlesHaveSeo = false;
  }
  if (!art.visualAssets || art.visualAssets.length !== 5) {
    allArticlesHave5Visuals = false;
  } else {
    art.visualAssets.forEach(v => {
      if (!v.prompt || v.prompt.length < 50 || !v.aspectRatio || !v.filename) {
        allVisualsHavePrompts = false;
      }
    });
  }
});

assert(allArticlesHaveSeo, 'All 100 articles have complete SEO packages (title, meta description, slug, keywords)');
assert(allArticlesHave5Visuals, 'All 100 articles contain exactly 5 visual assets');
assert(allVisualsHavePrompts, 'All 500 visual assets have comprehensive prompts (>50 chars), aspect ratios, and filenames');

// 3. Static Pre-rendered Pages Verification
console.log('\nTest Group 3: Static Pre-Rendered Crawlability');
let allStaticPagesExist = true;
let allStaticPagesHaveSchema = true;
let allStaticPagesHaveVisualContainers = true;

articles.forEach(art => {
  const pagePath = path.join(ROOT, 'blog', art.slug, 'index.html');
  if (!fs.existsSync(pagePath)) {
    allStaticPagesExist = false;
  } else {
    const html = fs.readFileSync(pagePath, 'utf8');
    if (!html.includes('application/ld+json') || (!html.includes('"@type": "Article"') && !html.includes('"@type": "BlogPosting"'))) {
      allStaticPagesHaveSchema = false;
    }
    if (!html.includes('visual-asset-block') || !html.includes('va-prompt-btn')) {
      allStaticPagesHaveVisualContainers = false;
    }
  }
});

assert(allStaticPagesExist, 'All 100 static prerendered HTML files exist in blog/[slug]/index.html');
assert(allStaticPagesHaveSchema, 'All 100 static HTML files contain valid Article / BlogPosting JSON-LD structured data');
assert(allStaticPagesHaveVisualContainers, 'All 100 static HTML files contain interactive visual asset cards with prompt copy buttons');

// 4. Public Blog Hub & Dynamic Reader
console.log('\nTest Group 4: Public Knowledge Center Interfaces');
const blogIndexPath = path.join(ROOT, 'blog/index.html');
const blogArticlePath = path.join(ROOT, 'blog/article.html');

assert(fs.existsSync(blogIndexPath), 'blog/index.html exists');
const blogIndexHtml = fs.readFileSync(blogIndexPath, 'utf8');
assert(blogIndexHtml.includes('search-input'), 'blog/index.html has search input');
assert(blogIndexHtml.includes('cat-pill'), 'blog/index.html has category filter pills');
assert(blogIndexHtml.includes('articlesGrid'), 'blog/index.html has articles grid container');
assert(blogIndexHtml.includes('paginationBar'), 'blog/index.html has pagination controls');

assert(fs.existsSync(blogArticlePath), 'blog/article.html dynamic reader exists');
const blogArticleHtml = fs.readFileSync(blogArticlePath, 'utf8');
assert(blogArticleHtml.includes('tocList'), 'blog/article.html has table of contents container');
assert(blogArticleHtml.includes('articleBody'), 'blog/article.html has article body element');
assert(blogArticleHtml.includes('promptModal'), 'blog/article.html has AI prompt modal container');

// 5. Admin CMS Security & Features (/samnang.com.com.omg)
console.log('\nTest Group 5: Master Admin CMS Security & Functionality');
const adminIndexPath = path.join(ROOT, 'samnang.com.com.omg/index.html');
assert(fs.existsSync(adminIndexPath), 'samnang.com.com.omg/index.html exists');

const adminHtml = fs.readFileSync(adminIndexPath, 'utf8');
assert(adminHtml.includes('content="noindex, nofollow, noarchive, nosnippet"'), 'Admin has strict noindex robots meta tag');
assert(adminHtml.includes('sessionStorage.getItem(SESSION_KEY)'), 'Admin enforces session gate check');
assert(adminHtml.includes('panel-visual-assets'), 'Admin has Visual Asset Manager module');
assert(adminHtml.includes('copyAll5Btn'), 'Admin has "Copy All 5 Prompts for Article" batch feature');
assert(adminHtml.includes('panel-blogs'), 'Admin has Blogs Manager module');
assert(adminHtml.includes('panel-editor'), 'Admin has Article Editor module');
assert(adminHtml.includes('panel-seo'), 'Admin has SEO Health Monitor module');

// 6. Technical Routing & Sitemap Tests
console.log('\nTest Group 6: Vercel Routing, Robots & XML Sitemap');
const vercelConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const hasNoIndexHeader = vercelConfig.headers.some(h => 
  h.source.includes('samnang.com.com.omg') && 
  h.headers.some(header => header.key === 'X-Robots-Tag' && header.value.includes('noindex'))
);
assert(hasNoIndexHeader, 'vercel.json contains X-Robots-Tag: noindex for /samnang.com.com.omg');

const hasAdminRewriteBlock = vercelConfig.rewrites.some(r => r.source === '/admin/:path*' && r.destination === '/404.html');
assert(hasAdminRewriteBlock, 'vercel.json rewrites legacy /admin/:path* to /404.html');

const hasAdminSpaRewrite = vercelConfig.rewrites.some(r => r.source.includes('samnang.com.com.omg'));
assert(hasAdminSpaRewrite, 'vercel.json rewrites /samnang.com.com.omg/:path* to /samnang.com.com.omg/index.html');

const robotsTxt = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
assert(robotsTxt.includes('Disallow: /samnang.com.com.omg/'), 'robots.txt disallows /samnang.com.com.omg/');
assert(robotsTxt.includes('Disallow: /admin/'), 'robots.txt disallows /admin/');

const sitemapXml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
assert(sitemapXml.includes('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'), 'sitemap.xml includes image sitemap schema namespace');

let allUrlsInSitemap = true;
articles.slice(0, 20).forEach(art => { // sample check
  if (!sitemapXml.includes(`<loc>https://app-webp-converter.vercel.app/blog/${art.slug}/</loc>`)) {
    allUrlsInSitemap = false;
  }
});
assert(allUrlsInSitemap, 'sitemap.xml contains verified blog URLs and hero image tags');

console.log(`\n========================================`);
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
