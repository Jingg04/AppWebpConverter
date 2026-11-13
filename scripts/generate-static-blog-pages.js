/**
 * Static Pre-renderer for All 100 Blog Articles
 * Generates blog/[slug]/index.html with full server-rendered HTML for peak SEO crawlability
 */

const fs = require('fs');
const path = require('path');

const articles = require('../data/blog-articles.json');
const templateHtml = fs.readFileSync(path.join(__dirname, '..', 'blog', 'article.html'), 'utf8');

console.log(`Pre-rendering ${articles.length} static article pages...`);

const blogDir = path.join(__dirname, '..', 'blog');

let generatedCount = 0;

articles.forEach(a => {
  const articleDir = path.join(blogDir, a.slug);
  if (!fs.existsSync(articleDir)) {
    fs.mkdirSync(articleDir, { recursive: true });
  }

  // Generate visual asset HTML blocks
  const vaBlocksHtml = (a.visualAssets || []).map((va, idx) => `
    <div class="visual-asset-block">
      <div class="va-header">
        <span class="va-type-badge">${escapeHtml(va.type || 'Visual Asset')}</span>
        <span style="font-size: 0.8125rem; color: #94A3B8;">Asset #${idx + 1} &bull; ${escapeHtml(va.aspectRatio || '16:9')}</span>
      </div>
      <div class="va-canvas-preview">
        <div style="font-size: 0.75rem; text-transform: uppercase; color: #38BDF8; font-weight: 700; margin-bottom: 4px;">${escapeHtml(va.placement || 'Embedded')}</div>
        <h3 class="va-title">${escapeHtml(va.title)}</h3>
        <p class="va-concept">${escapeHtml(va.concept)}</p>
      </div>
      <div class="va-footer">
        <span class="va-caption">"${escapeHtml(va.caption || va.altText)}"</span>
        <button class="va-prompt-btn" data-prompt="${escapeAttr(va.prompt)}" data-title="${escapeAttr(va.title)}" data-filename="${escapeAttr(va.filename)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          Inspect AI Prompt
        </button>
      </div>
    </div>
  `).join('');

  // Generate FAQ HTML
  const faqHtml = (a.faq || []).map(f => `
    <div class="faq-item">
      <div class="faq-question">
        <span>${escapeHtml(f.q)}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </div>
      <div class="faq-answer">
        <p style="margin: 0;">${escapeHtml(f.a)}</p>
      </div>
    </div>
  `).join('');

  // Generate Structured Data Schema
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": a.canonicalUrl + "#article",
        "headline": a.h1 || a.title,
        "description": a.metaDescription || a.excerpt,
        "author": { "@type": "Person", "name": a.author ? a.author.name : "FluxWebP Team" },
        "publisher": { "@type": "Organization", "name": "FluxWebP Pro" },
        "datePublished": a.publishedDate,
        "dateModified": a.updatedDate || a.publishedDate,
        "mainEntityOfPage": a.canonicalUrl
      },
      {
        "@type": "BreadcrumbList",
        "@id": a.canonicalUrl + "#breadcrumbs",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://app-webp-converter.vercel.app/" },
          { "@type": "ListItem", "position": 2, "name": "Knowledge Center", "item": "https://app-webp-converter.vercel.app/blog/" },
          { "@type": "ListItem", "position": 3, "name": a.title, "item": a.canonicalUrl }
        ]
      }
    ]
  };

  if (a.faq && a.faq.length > 0) {
    schema["@graph"].push({
      "@type": "FAQPage",
      "@id": a.canonicalUrl + "#faq",
      "mainEntity": a.faq.map(f => ({
        "@type": "Question",
        "name": f.q,
        "acceptedAnswer": { "@type": "Answer", "text": f.a }
      }))
    });
  }

  // Pre-fill HTML template
  let pageHtml = templateHtml
    .replace('<title id="metaTitle">Technical Guide | FluxWebP Pro Knowledge Center</title>', `<title id="metaTitle">${escapeHtml(a.metaTitle || a.title + ' | FluxWebP Pro')}</title>`)
    .replace('id="metaDesc" name="description" content="In-depth technical image processing and web performance guide from FluxWebP Pro."', `id="metaDesc" name="description" content="${escapeAttr(a.metaDescription || a.excerpt)}"`)
    .replace('id="canonicalLink" rel="canonical" href="https://app-webp-converter.vercel.app/blog/"', `id="canonicalLink" rel="canonical" href="${a.canonicalUrl}"`)
    .replace('id="ogTitle" property="og:title" content="FluxWebP Pro Technical Guide"', `id="ogTitle" property="og:title" content="${escapeAttr(a.metaTitle || a.title)}"`)
    .replace('id="ogDesc" property="og:description" content="In-depth technical image processing and web performance guide."', `id="ogDesc" property="og:description" content="${escapeAttr(a.metaDescription || a.excerpt)}"`)
    .replace('id="ogUrl" property="og:url" content="https://app-webp-converter.vercel.app/blog/"', `id="ogUrl" property="og:url" content="${a.canonicalUrl}"`)
    .replace('<span id="breadcrumbCategory" style="color: var(--text-secondary);">Category</span>', `<span id="breadcrumbCategory" style="color: var(--text-secondary);">${escapeHtml(a.category)}</span>`)
    .replace('<span id="breadcrumbTitle" style="color: var(--text-main); font-weight: 600;">Article</span>', `<span id="breadcrumbTitle" style="color: var(--text-main); font-weight: 600;">${escapeHtml(a.title)}</span>`)
    .replace('<span class="article-category-badge" id="articleCatBadge">Category</span>', `<span class="article-category-badge" id="articleCatBadge">${escapeHtml(a.category)}</span>`)
    .replace('<h1 class="article-h1" id="articleH1">Loading article...</h1>', `<h1 class="article-h1" id="articleH1">${escapeHtml(a.h1 || a.title)}</h1>`)
    .replace('<span class="author-avatar-lg" id="authorAvatar">F</span>', `<span class="author-avatar-lg" id="authorAvatar">${escapeHtml(a.author ? a.author.name.charAt(0) : 'F')}</span>`)
    .replace('<strong id="authorName" style="color: var(--text-main); display: block;">Author</strong>', `<strong id="authorName" style="color: var(--text-main); display: block;">${escapeHtml(a.author ? a.author.name : 'FluxWebP Team')}</strong>`)
    .replace('<span id="authorRole" style="font-size: 0.75rem; color: var(--text-muted);">Specialist</span>', `<span id="authorRole" style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(a.author ? a.author.role : 'Specialist')}</span>`)
    .replace('<span id="publishedDate">Date</span>', `<span id="publishedDate">Published: ${a.publishedDate}</span>`)
    .replace('<span id="readingTime">0 min read</span>', `<span id="readingTime">${a.readingTime} min read</span>`)
    .replace('<article class="article-prose" id="articleBody">\n            <p>Loading full technical guide...</p>\n          </article>', `<article class="article-prose" id="articleBody">${a.bodyHtml || '<p>' + a.excerpt + '</p>'}</article>`)
    .replace('<div id="visualAssetsContainer">\n            <!-- Dynamically populated 5 visual asset cards -->\n          </div>', `<div id="visualAssetsContainer">${vaBlocksHtml}</div>`)
    .replace('<div id="faqList">\n            <!-- Dynamically populated FAQ items -->\n          </div>', `<div id="faqList">${faqHtml}</div>`);

  if (a.toolCta) {
    pageHtml = pageHtml
      .replace('<h3 style="font-size: 1.35rem; font-weight: 700; color: var(--text-main); margin-bottom: 6px;" id="ctaToolName">Try FluxWebP Pro Tools</h3>', `<h3 style="font-size: 1.35rem; font-weight: 700; color: var(--text-main); margin-bottom: 6px;" id="ctaToolName">${escapeHtml(a.toolCta.toolName || 'FluxWebP Creative Suite')}</h3>`)
      .replace('<p style="color: var(--text-secondary); margin: 0;" id="ctaDescription">Put this technical guide into practice with our fast on-device image suite.</p>', `<p style="color: var(--text-secondary); margin: 0;" id="ctaDescription">${escapeHtml(a.toolCta.ctaText || 'Optimize your images with our on-device tools.')}</p>`)
      .replace('id="ctaBtn" style="background: #2563EB; color: #FFF; padding: 12px 24px; border-radius: 10px; font-weight: 700; text-decoration: none;"', `id="ctaBtn" href="${a.toolCta.toolUrl || '/'}" style="background: #2563EB; color: #FFF; padding: 12px 24px; border-radius: 10px; font-weight: 700; text-decoration: none;"`);
  }

  // Replace structured data block
  pageHtml = pageHtml.replace(
    /<script type="application\/ld\+json" id="structuredDataScript">[\s\S]*?<\/script>/,
    `<script type="application/ld+json" id="structuredDataScript">\n${JSON.stringify(schema, null, 2)}\n</script>`
  );

  fs.writeFileSync(path.join(articleDir, 'index.html'), pageHtml, 'utf8');
  generatedCount++;
});

console.log(`✅ Successfully generated ${generatedCount} static article HTML pages in blog/[slug]/index.html`);

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/"/g, '&quot;');
}

