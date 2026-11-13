/**
 * Master Blog Database Builder
 * Aggregates all 10 categories into:
 *  - data/blog-articles.json (Full 100 articles + 500 visual assets)
 *  - data/blog-manifest.json (Fast client index)
 *  - data/visual-assets-catalog.json (500 prompt records)
 */

const fs = require('fs');
const path = require('path');

const cat01 = require('./categories/cat01-formats.js');
const cat02 = require('./categories/cat02-tutorials.js');
const cat03 = require('./categories/cat03-compression.js');
const cat04 = require('./categories/cat04-resizing.js');
const cat05 = require('./categories/cat05-editing.js');
const cat06 = require('./categories/cat06-bg-removal.js');
const cat07 = require('./categories/cat07-poster-design.js');
const cat08 = require('./categories/cat08-seo-performance.js');
const cat09 = require('./categories/cat09-ecommerce.js');
const cat10 = require('./categories/cat10-privacy-troubleshooting.js');

const allArticles = [
  ...cat01,
  ...cat02,
  ...cat03,
  ...cat04,
  ...cat05,
  ...cat06,
  ...cat07,
  ...cat08,
  ...cat09,
  ...cat10
];

console.log(`Total loaded articles: ${allArticles.length}`);

// Validation checks
if (allArticles.length !== 100) {
  console.warn(`WARNING: Expected exactly 100 articles, found ${allArticles.length}`);
}

// Collect all visual assets
const allVisualAssets = [];
allArticles.forEach(article => {
  if (!article.visualAssets || article.visualAssets.length !== 5) {
    console.warn(`Article #${article.id} (${article.title}) has ${article.visualAssets ? article.visualAssets.length : 0} visual assets (expected 5)`);
  }
  (article.visualAssets || []).forEach(va => {
    allVisualAssets.push({
      ...va,
      articleTitle: article.title,
      articleSlug: article.slug,
      category: article.category,
      categorySlug: article.categorySlug
    });
  });
});

console.log(`Total collected visual assets: ${allVisualAssets.length}`);

// Generate compact manifest for fast browsing/search
const manifest = allArticles.map(a => ({
  id: a.id,
  title: a.title,
  slug: a.slug,
  category: a.category,
  categorySlug: a.categorySlug,
  subcategory: a.subcategory,
  searchIntent: a.searchIntent,
  primaryKeyword: a.primaryKeyword,
  metaDescription: a.metaDescription,
  excerpt: a.excerpt,
  author: a.author,
  publishedDate: a.publishedDate,
  updatedDate: a.updatedDate,
  readingTime: a.readingTime,
  toolCta: a.toolCta,
  visualCount: a.visualAssets ? a.visualAssets.length : 0,
  heroVisual: a.visualAssets && a.visualAssets[0] ? {
    title: a.visualAssets[0].title,
    filename: a.visualAssets[0].filename,
    altText: a.visualAssets[0].altText
  } : null
}));

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Write master datasets
fs.writeFileSync(path.join(dataDir, 'blog-articles.json'), JSON.stringify(allArticles, null, 2), 'utf8');
fs.writeFileSync(path.join(dataDir, 'blog-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
fs.writeFileSync(path.join(dataDir, 'visual-assets-catalog.json'), JSON.stringify(allVisualAssets, null, 2), 'utf8');

console.log('✅ Successfully compiled master blog database:');
console.log(` - data/blog-articles.json (${allArticles.length} articles)`);
console.log(` - data/blog-manifest.json (${manifest.length} manifest entries)`);
console.log(` - data/visual-assets-catalog.json (${allVisualAssets.length} visual asset prompts)`);

