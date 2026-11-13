// api/admin/backup.js
const fs = require('fs');
const path = require('path');
const { getSession } = require('./_auth-helper');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  // Enforce server-side authentication
  const session = getSession(req);
  if (!session) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Unauthorized: Administrative session required' }));
  }

  const ROOT = path.resolve(__dirname, '../..');
  const contentBlogDir = path.join(ROOT, 'content/blog');
  const manifestPath = path.join(contentBlogDir, 'manifest.json');
  const categoriesPath = path.join(ROOT, 'data/blog-categories.json');

  // GET: Export entire database-free content package
  if (req.method === 'GET') {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));

      const fullPackage = {
        exportTimestamp: new Date().toISOString(),
        version: '2.0.0',
        platform: 'FluxWebP Pro',
        totalArticles: manifest.length,
        categories,
        manifest,
        articles: []
      };

      for (const item of manifest) {
        const folder = path.join(contentBlogDir, item.folder);
        let metadata = null;
        let visualPrompts = [];
        let mdxContent = '';

        if (fs.existsSync(path.join(folder, 'metadata.json'))) {
          metadata = JSON.parse(fs.readFileSync(path.join(folder, 'metadata.json'), 'utf8'));
        }
        if (fs.existsSync(path.join(folder, 'visual-prompts.json'))) {
          visualPrompts = JSON.parse(fs.readFileSync(path.join(folder, 'visual-prompts.json'), 'utf8'));
        }
        if (fs.existsSync(path.join(folder, 'article.mdx'))) {
          mdxContent = fs.readFileSync(path.join(folder, 'article.mdx'), 'utf8');
        }

        fullPackage.articles.push({
          id: item.id,
          slug: item.slug,
          folder: item.folder,
          metadata,
          visualPrompts,
          mdxContent
        });
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="fluxwebp-content-backup-${new Date().toISOString().slice(0, 10)}.json"`);
      return res.end(JSON.stringify(fullPackage, null, 2));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // POST: Validate backup package before import
  if (req.method === 'POST') {
    let body = {};
    try {
      if (typeof req.body === 'object') body = req.body;
      else if (req.body) body = JSON.parse(req.body);
      else {
        const buffers = [];
        for await (const chunk of req) buffers.push(chunk);
        const data = Buffer.concat(buffers).toString();
        if (data) body = JSON.parse(data);
      }
    } catch (_) {}

    const importedArticles = body.articles || [];
    const validationErrors = [];
    const duplicates = [];
    const existingSlugs = new Set();

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      manifest.forEach(a => existingSlugs.add(a.slug));
    } catch (_) {}

    importedArticles.forEach((art, idx) => {
      if (!art.title && !art.metadata?.title) validationErrors.push(`Article #${idx + 1} missing title`);
      const slug = art.slug || art.metadata?.slug;
      if (!slug) validationErrors.push(`Article #${idx + 1} missing slug`);
      else if (existingSlugs.has(slug)) duplicates.push(slug);
    });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      valid: validationErrors.length === 0,
      totalImported: importedArticles.length,
      errorsCount: validationErrors.length,
      errors: validationErrors.slice(0, 10),
      duplicatesCount: duplicates.length,
      duplicateSlugs: duplicates.slice(0, 10),
      timestamp: new Date().toISOString()
    }));
  }

  res.statusCode = 405;
  res.end('Method Not Allowed');
};
