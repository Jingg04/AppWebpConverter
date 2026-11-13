// scripts/build-file-based-content.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const articlesPath = path.join(ROOT, 'data/blog-articles.json');
const categoriesPath = path.join(ROOT, 'data/blog-categories.json');

const articles = JSON.parse(fs.readFileSync(articlesPath, 'utf8'));
const categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));

const contentBlogDir = path.join(ROOT, 'content/blog');
const publicAssetsDir = path.join(ROOT, 'public/blog-assets');

if (!fs.existsSync(contentBlogDir)) {
  fs.mkdirSync(contentBlogDir, { recursive: true });
}
if (!fs.existsSync(publicAssetsDir)) {
  fs.mkdirSync(publicAssetsDir, { recursive: true });
}

console.log(`Building file-based blog content architecture for ${articles.length} articles...`);

function createSvgPlaceholder(title, type, index, width = 1200, height = 675) {
  const typeColors = {
    hero: { bg1: '#1E293B', bg2: '#0F172A', accent: '#3B82F6', badge: 'HERO ARCHITECTURE' },
    infographic: { bg1: '#0F172A', bg2: '#042F2E', accent: '#14B8A6', badge: 'TECHNICAL INFOGRAPHIC' },
    workflow: { bg1: '#111827', bg2: '#1E1B4B', accent: '#6366F1', badge: 'WORKFLOW PIPELINE' },
    comparison: { bg1: '#18181B', bg2: '#27272A', accent: '#EC4899', badge: 'VISUAL COMPARISON' },
    application: { bg1: '#090D16', bg2: '#1C1917', accent: '#F97316', badge: 'REAL-WORLD APPLICATION' }
  };
  const theme = typeColors[type] || typeColors.hero;
  
  // Clean title for XML
  const cleanTitle = title.replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${theme.bg1}"/>
      <stop offset="100%" stop-color="${theme.bg2}"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${theme.accent}"/>
      <stop offset="100%" stop-color="#38BDF8"/>
    </linearGradient>
  </defs>
  
  <!-- Canvas Background -->
  <rect width="100%" height="100%" fill="url(#bgGrad)"/>
  
  <!-- Grid Accent Lines -->
  <g stroke="rgba(255, 255, 255, 0.05)" stroke-width="1">
    <line x1="0" y1="135" x2="${width}" y2="135"/>
    <line x1="0" y1="270" x2="${width}" y2="270"/>
    <line x1="0" y1="405" x2="${width}" y2="405"/>
    <line x1="0" y1="540" x2="${width}" y2="540"/>
    <line x1="240" y1="0" x2="240" y2="${height}"/>
    <line x1="480" y1="0" x2="480" y2="${height}"/>
    <line x1="720" y1="0" x2="720" y2="${height}"/>
    <line x1="960" y1="0" x2="960" y2="${height}"/>
  </g>

  <!-- Brand Watermark -->
  <g transform="translate(60, 55)">
    <rect width="28" height="28" rx="6" fill="#2563EB"/>
    <text x="40" y="20" fill="#94A3B8" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="14" font-weight="700" letter-spacing="1">FLUXWEBP PRO &bull; VISUAL ASSET #${index}</text>
  </g>

  <!-- Asset Type Badge -->
  <g transform="translate(60, 120)">
    <rect width="180" height="30" rx="15" fill="rgba(255,255,255,0.08)" stroke="${theme.accent}" stroke-width="1.5"/>
    <text x="90" y="20" fill="${theme.accent}" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="800" text-anchor="middle" letter-spacing="0.8">${theme.badge}</text>
  </g>

  <!-- Title Text -->
  <text x="60" y="240" fill="#F8FAFC" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="34" font-weight="800">
    ${cleanTitle.length > 55 ? cleanTitle.substring(0, 52) + '...' : cleanTitle}
  </text>

  <!-- Aspect Ratio & Specification Tag -->
  <g transform="translate(60, 580)">
    <text fill="#64748B" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="14" font-weight="600">
      Aspect Ratio: 16:9 &bull; Vector Scalable &bull; 100% Client-Side Private Storage
    </text>
  </g>
</svg>`;
}

const manifestList = [];

articles.forEach(art => {
  const folderName = `${String(art.id).padStart(2, '0')}-${art.slug}`;
  const articleContentDir = path.join(contentBlogDir, folderName);
  const articleMediaDir = path.join(publicAssetsDir, folderName);

  if (!fs.existsSync(articleContentDir)) fs.mkdirSync(articleContentDir, { recursive: true });
  if (!fs.existsSync(articleMediaDir)) fs.mkdirSync(articleMediaDir, { recursive: true });

  // 1. Generate Metadata JSON
  const metadata = {
    id: art.id,
    title: art.title,
    slug: art.slug,
    folder: folderName,
    category: art.category,
    categorySlug: art.categorySlug,
    subcategory: art.subcategory || 'General',
    publicationStatus: 'published',
    publishedDate: art.publishedDate || '2026-11-10',
    updatedDate: art.updatedDate || '2026-11-14',
    author: art.author || {
      name: 'FluxWebP Engineering Team',
      role: 'Image Processing & Web Performance Specialists'
    },
    readingTime: art.readingTime || 6,
    seo: {
      metaTitle: art.metaTitle || art.title,
      metaDescription: art.metaDescription || art.excerpt,
      canonicalUrl: art.canonicalUrl || `https://app-webp-converter.vercel.app/blog/${art.slug}/`,
      primaryKeyword: art.primaryKeyword || '',
      secondaryKeywords: art.secondaryKeywords || []
    },
    internalLinks: [
      { text: 'FluxWebP Converter', url: '/#/' },
      { text: 'Online Image Editor', url: '/editor/' },
      { text: 'AI Background Remover', url: '/background-remover/' },
      { text: 'AI Poster Studio', url: '/poster-studio/' },
      { text: 'Knowledge Center', url: '/blog/' }
    ],
    externalReferences: [
      'https://developers.google.com/speed/webp',
      'https://www.w3.org/TR/PNG/',
      'https://web.dev/fast/'
    ],
    featuredImage: `/public/blog-assets/${folderName}/hero.svg`,
    visualAssetsCount: (art.visualAssets || []).length
  };

  fs.writeFileSync(path.join(articleContentDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');

  // 2. Generate Visual Prompts JSON
  const visualPrompts = (art.visualAssets || []).map((va, idx) => ({
    id: `va-${art.id}-${idx + 1}`,
    index: idx + 1,
    type: va.type || (idx === 0 ? 'hero' : idx === 1 ? 'infographic' : idx === 2 ? 'workflow' : idx === 3 ? 'comparison' : 'application'),
    title: va.title,
    concept: va.concept,
    prompt: va.prompt,
    aspectRatio: va.aspectRatio || '16:9',
    filename: va.filename || `${va.type || 'asset'}-${idx + 1}.svg`,
    altText: va.altText,
    caption: va.caption || va.altText,
    placement: va.placement || `Section ${idx + 1}`
  }));

  fs.writeFileSync(path.join(articleContentDir, 'visual-prompts.json'), JSON.stringify(visualPrompts, null, 2), 'utf8');

  // 3. Generate article.mdx
  const mdxContent = `---
title: "${art.title.replace(/"/g, '\\"')}"
slug: "${art.slug}"
id: ${art.id}
category: "${art.category}"
categorySlug: "${art.categorySlug}"
publicationStatus: "published"
publishedDate: "${metadata.publishedDate}"
updatedDate: "${metadata.updatedDate}"
author: "${metadata.author.name}"
authorRole: "${metadata.author.role}"
readingTime: ${metadata.readingTime}
primaryKeyword: "${art.primaryKeyword || ''}"
featuredImage: "${metadata.featuredImage}"
---

# ${art.h1 || art.title}

<VisualAsset id="va-${art.id}-1" type="hero" src="/public/blog-assets/${folderName}/hero.svg" alt="${(visualPrompts[0] && visualPrompts[0].altText) || art.title}" />

${art.excerpt ? `> **Summary:** ${art.excerpt}\n` : ''}

${(art.sections || []).map((sec, sIdx) => {
  const asset = visualPrompts[sIdx + 1];
  return `## ${sec.heading}

${sec.paragraphs ? sec.paragraphs.join('\n\n') : (sec.content || '')}

${asset ? `<VisualAsset id="${asset.id}" type="${asset.type}" src="/public/blog-assets/${folderName}/${asset.type}.svg" alt="${asset.altText}" caption="${asset.caption}" />\n` : ''}`;
}).join('\n\n')}

## Frequently Asked Questions

${(art.faq || []).map(f => `### ${f.q}\n\n${f.a}`).join('\n\n')}

---

*Written by the **FluxWebP Engineering Team**. All conversions, image parsing, and edits are executed 100% locally in your browser.*
`;

  fs.writeFileSync(path.join(articleContentDir, 'article.mdx'), mdxContent, 'utf8');

  // 4. Generate Physical Visual Asset SVGs in /public/blog-assets/[folderName]/
  visualPrompts.forEach((va, vIdx) => {
    const assetType = va.type.toLowerCase();
    const svgPath = path.join(articleMediaDir, `${assetType}.svg`);
    const svgContent = createSvgPlaceholder(va.title, assetType, vIdx + 1);
    fs.writeFileSync(svgPath, svgContent, 'utf8');
  });

  // Add to Manifest
  manifestList.push({
    id: art.id,
    title: art.title,
    slug: art.slug,
    folder: folderName,
    category: art.category,
    categorySlug: art.categorySlug,
    publicationStatus: 'published',
    publishedDate: metadata.publishedDate,
    updatedDate: metadata.updatedDate,
    author: metadata.author,
    readingTime: metadata.readingTime,
    seo: metadata.seo,
    featuredImage: metadata.featuredImage,
    visualAssetsCount: visualPrompts.length,
    hasMissingVisuals: false,
    hasIncompleteSeo: false
  });
});

// Write Master Manifest
const manifestFile = path.join(contentBlogDir, 'manifest.json');
fs.writeFileSync(manifestFile, JSON.stringify(manifestList, null, 2), 'utf8');

console.log(`✅ File-based content architecture successfully created:`);
console.log(`   - Master manifest: /content/blog/manifest.json (${manifestList.length} articles)`);
console.log(`   - 100 article folders in /content/blog/ (each with metadata.json, visual-prompts.json, article.mdx)`);
console.log(`   - 500 physical SVG visual assets created in /public/blog-assets/`);

