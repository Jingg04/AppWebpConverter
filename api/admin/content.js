// api/admin/content.js
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

  const url = new URL(req.url, 'http://localhost');
  const action = url.searchParams.get('action') || 'manifest';

  const ROOT = path.resolve(__dirname, '../..');
  const contentBlogDir = path.join(ROOT, 'content/blog');
  const manifestPath = path.join(contentBlogDir, 'manifest.json');

  // GET: Fetch Manifest, Article, or Real Stats
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');

    if (action === 'stats') {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const total = manifest.length;
        const published = manifest.filter(a => a.publicationStatus === 'published').length;
        const drafts = manifest.filter(a => a.publicationStatus === 'draft').length;
        const pendingReview = manifest.filter(a => a.publicationStatus === 'review').length;
        const missingVisuals = manifest.filter(a => a.visualAssetsCount < 5).length;
        const incompleteSeo = manifest.filter(a => !a.seo || !a.seo.metaTitle || !a.seo.metaDescription).length;
        const totalVisualPrompts = manifest.reduce((sum, a) => sum + (a.visualAssetsCount || 0), 0);

        // Category breakdown
        const categoryCounts = {};
        manifest.forEach(a => {
          categoryCounts[a.category] = (categoryCounts[a.category] || 0) + 1;
        });

        res.statusCode = 200;
        return res.end(JSON.stringify({
          totalArticles: total,
          publishedArticles: published,
          draftArticles: drafts,
          pendingReview,
          missingVisuals,
          incompleteSeo,
          totalVisualPrompts,
          categoryCounts,
          calculatedAt: new Date().toISOString()
        }));
      } catch (err) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    if (action === 'get') {
      const id = url.searchParams.get('id');
      const slug = url.searchParams.get('slug');
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const item = manifest.find(a => (id && String(a.id) === String(id)) || (slug && a.slug === slug));
        if (!item) {
          res.statusCode = 404;
          return res.end(JSON.stringify({ error: 'Article not found' }));
        }

        const articleDir = path.join(contentBlogDir, item.folder);
        const metadata = JSON.parse(fs.readFileSync(path.join(articleDir, 'metadata.json'), 'utf8'));
        const visualPrompts = JSON.parse(fs.readFileSync(path.join(articleDir, 'visual-prompts.json'), 'utf8'));
        const mdxContent = fs.readFileSync(path.join(articleDir, 'article.mdx'), 'utf8');

        res.statusCode = 200;
        return res.end(JSON.stringify({
          manifestItem: item,
          metadata,
          visualPrompts,
          mdxContent
        }));
      } catch (err) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    // Default: Return manifest
    try {
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        res.statusCode = 200;
        return res.end(JSON.stringify(manifest));
      } else {
        // Fallback to data/blog-manifest.json
        const dataManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/blog-manifest.json'), 'utf8'));
        res.statusCode = 200;
        return res.end(JSON.stringify(dataManifest));
      }
    } catch (err) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // POST: Save draft, update metadata, or publish
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

    const { id, title, slug, category, publicationStatus, mdxContent, metadata, visualPrompts } = body;

    // Check if Git-backed GitHub API integration is enabled via environment variables
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const GITHUB_REPO = process.env.GITHUB_REPO || 'Jingg04/AppWebpConverter';

    let gitCommitted = false;
    let gitCommitUrl = null;

    if (GITHUB_TOKEN) {
      // Direct commit via GitHub API
      try {
        const folderName = `${String(id).padStart(2, '0')}-${slug}`;
        const filePath = `content/blog/${folderName}/metadata.json`;
        
        // Fetch current file SHA
        const getRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`, {
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'User-Agent': 'FluxWebP-Admin-CMS'
          }
        });
        let currentSha = null;
        if (getRes.ok) {
          const getJson = await getRes.json();
          currentSha = getJson.sha;
        }

        // Commit updated metadata
        const putRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'User-Agent': 'FluxWebP-Admin-CMS',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `cms(blog): update article #${id} (${slug}) [skip ci]`,
            content: Buffer.from(JSON.stringify(metadata, null, 2)).toString('base64'),
            sha: currentSha
          })
        });

        if (putRes.ok) {
          const putJson = await putRes.json();
          gitCommitted = true;
          gitCommitUrl = putJson.commit?.html_url;
        }
      } catch (gitErr) {
        console.warn('GitHub API commit error:', gitErr.message);
      }
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      success: true,
      message: gitCommitted ? 'Article committed directly to Git repository' : 'Article draft package generated successfully',
      gitCommitted,
      gitCommitUrl,
      requiresDownload: !gitCommitted,
      updatedArticle: { id, title, slug, category, publicationStatus }
    }));
  }

  res.statusCode = 405;
  res.end('Method Not Allowed');
};

