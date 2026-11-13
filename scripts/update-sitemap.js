// scripts/update-sitemap.js
const fs = require('fs');
const path = require('path');

const articles = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/blog-articles.json'), 'utf8'));

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

const coreUrls = [
  { loc: 'https://app-webp-converter.vercel.app/', lastmod: '2026-11-14', changefreq: 'daily', priority: '1.0' },
  { loc: 'https://app-webp-converter.vercel.app/editor/', lastmod: '2026-11-14', changefreq: 'weekly', priority: '0.95' },
  { loc: 'https://app-webp-converter.vercel.app/poster-studio/', lastmod: '2026-11-14', changefreq: 'weekly', priority: '0.95' },
  { loc: 'https://app-webp-converter.vercel.app/ai-poster-generator/', lastmod: '2026-11-14', changefreq: 'weekly', priority: '0.90' },
  { loc: 'https://app-webp-converter.vercel.app/background-remover/', lastmod: '2026-11-14', changefreq: 'weekly', priority: '0.95' },
  { loc: 'https://app-webp-converter.vercel.app/resizer/', lastmod: '2026-11-14', changefreq: 'weekly', priority: '0.90' },
  { loc: 'https://app-webp-converter.vercel.app/projects/', lastmod: '2026-11-14', changefreq: 'weekly', priority: '0.85' },
  { loc: 'https://app-webp-converter.vercel.app/jpg-to-webp/', lastmod: '2026-11-14', changefreq: 'weekly', priority: '0.90' },
  { loc: 'https://app-webp-converter.vercel.app/png-to-webp/', lastmod: '2026-11-14', changefreq: 'weekly', priority: '0.90' },
  { loc: 'https://app-webp-converter.vercel.app/image-compressor/', lastmod: '2026-11-14', changefreq: 'weekly', priority: '0.90' },
  { loc: 'https://app-webp-converter.vercel.app/heic-converter/', lastmod: '2026-11-14', changefreq: 'weekly', priority: '0.80' },
  { loc: 'https://app-webp-converter.vercel.app/raw-image-converter/', lastmod: '2026-11-14', changefreq: 'weekly', priority: '0.80' },
  { loc: 'https://app-webp-converter.vercel.app/batch-image-converter/', lastmod: '2026-11-14', changefreq: 'weekly', priority: '0.80' },
  { loc: 'https://app-webp-converter.vercel.app/blog/', lastmod: '2026-11-14', changefreq: 'daily', priority: '0.90' },
  { loc: 'https://app-webp-converter.vercel.app/help/', lastmod: '2026-11-14', changefreq: 'weekly', priority: '0.80' },
  { loc: 'https://app-webp-converter.vercel.app/contact/', lastmod: '2026-11-14', changefreq: 'monthly', priority: '0.70' },
  { loc: 'https://app-webp-converter.vercel.app/about/', lastmod: '2026-11-14', changefreq: 'monthly', priority: '0.60' },
  { loc: 'https://app-webp-converter.vercel.app/privacy/', lastmod: '2026-11-14', changefreq: 'monthly', priority: '0.50' },
  { loc: 'https://app-webp-converter.vercel.app/terms/', lastmod: '2026-11-14', changefreq: 'monthly', priority: '0.50' }
];

let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <!-- Core Platform & Application Pages -->
`;

for (const core of coreUrls) {
  xml += `  <url>
    <loc>${core.loc}</loc>
    <lastmod>${core.lastmod}</lastmod>
    <changefreq>${core.changefreq}</changefreq>
    <priority>${core.priority}</priority>
  </url>
`;
}

xml += `
  <!-- 100 Premium Technical Knowledge Center Articles (FluxWebP Pro) -->
`;

for (const art of articles) {
  const heroAsset = (art.visualAssets && art.visualAssets[0]) ? art.visualAssets[0] : null;
  xml += `  <url>
    <loc>https://app-webp-converter.vercel.app/blog/${art.slug}/</loc>
    <lastmod>${art.dateModified || art.datePublished || '2026-11-14'}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.85</priority>
`;

  if (heroAsset) {
    xml += `    <image:image>
      <image:loc>https://app-webp-converter.vercel.app/assets/blog/${art.slug}/${heroAsset.filename}</image:loc>
      <image:title>${escapeXml(heroAsset.title || art.title)}</image:title>
      <image:caption>${escapeXml(heroAsset.caption || art.seo?.metaDescription || '')}</image:caption>
    </image:image>
`;
  }

  xml += `  </url>
`;
}

xml += `</urlset>
`;

const sitemapPath = path.join(__dirname, '../sitemap.xml');
fs.writeFileSync(sitemapPath, xml, 'utf8');
console.log(`Successfully generated sitemap.xml with ${coreUrls.length} core pages and ${articles.length} blog articles (Total: ${coreUrls.length + articles.length} URLs).`);
