/**
 * FluxWebP Pro — Provider-Independent AI Image Generation Serverless Adapter
 * Route: /api/generate-poster
 *
 * Supports:
 * - Public Cloud FLUX.1 Engine (Watermark-free, high-res real AI generation, zero setup required)
 * - Google Imagen 3 (via GEMINI_API_KEY or BYOK)
 * - OpenAI DALL-E 3 (via OPENAI_API_KEY or BYOK)
 * - Stability AI (via STABILITY_API_KEY or BYOK)
 * - Client-Provided BYOK via request headers (x-custom-api-key, x-provider)
 */

const https = require('https');
const http = require('http');

// Helper to fetch buffer with timeout and redirects
function fetchBuffer(url, options = {}, maxRedirects = 3) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https:');
    const client = isHttps ? https : http;

    const req = client.get(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects > 0) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith('http')) {
          const parsed = new URL(url);
          redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
        }
        return resolve(fetchBuffer(redirectUrl, options, maxRedirects - 1));
      }

      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error(`HTTP error ${res.statusCode}: ${res.statusMessage}`));
      }

      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });

    req.on('error', reject);
    req.setTimeout(35000, () => {
      req.destroy();
      reject(new Error('Generation request timed out after 35 seconds'));
    });
  });
}

// POST JSON helper
function postJson(url, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const client = u.protocol === 'https:' ? https : http;
    const bodyStr = JSON.stringify(payload);

    const req = client.request(
      u,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
          ...headers
        }
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ status: res.statusCode, data: parsed });
            } else {
              reject(new Error(parsed.error?.message || parsed.message || `Provider returned status ${res.statusCode}`));
            }
          } catch (e) {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ status: res.statusCode, raw: data });
            } else {
              reject(new Error(`Provider returned ${res.statusCode}: ${data.slice(0, 200)}`));
            }
          }
        });
      }
    );

    req.on('error', reject);
    req.setTimeout(40000, () => {
      req.destroy();
      reject(new Error('Provider request timed out'));
    });
    req.write(bodyStr);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-custom-api-key, x-provider');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Method Not Allowed. Use POST.' }));
  }

  // Parse body if not parsed by framework
  let body = req.body;
  if (!body) {
    try {
      const raw = await new Promise((resolve) => {
        let d = '';
        req.on('data', (c) => (d += c));
        req.on('end', () => resolve(d));
      });
      body = raw ? JSON.parse(raw) : {};
    } catch (_) {
      body = {};
    }
  }

  const {
    prompt,
    negativePrompt = '',
    width = 1080,
    height = 1080,
    style = 'commercial-advertising',
    provider = 'flux-community',
    seed = Math.floor(Math.random() * 1000000)
  } = body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Missing required parameter: prompt' }));
  }

  const startTime = Date.now();
  const customKey = req.headers['x-custom-api-key'] || body.customApiKey;
  const targetProvider = (req.headers['x-provider'] || provider || 'flux-community').toLowerCase();

  // Clamp resolution to safe bounds (minimum 512, maximum 1920)
  const safeW = Math.max(512, Math.min(1920, Math.round(Number(width) || 1080)));
  const safeH = Math.max(512, Math.min(1920, Math.round(Number(height) || 1080)));

  // Combine prompt with aesthetic commercial qualifiers
  let styledPrompt = prompt.trim();
  const styleKeywords = {
    'commercial-advertising': 'masterpiece commercial advertising photography, professional studio lighting, 8k resolution, razor sharp focus, high-end production quality, clean composition',
    'luxury-branding': 'luxury brand campaign, high fashion editorial, dramatic softbox lighting, elegant gold and marble accents, minimalist luxury aesthetic, Hasselblad medium format shot',
    'industrial-machinery': 'industrial engineering photography, clean workshop backdrop, dramatic metallic highlights, precision manufacturing, sharp architectural lighting, highly detailed',
    'cyber-tech': 'futuristic tech advertisement, sleek glowing accents, volumetric lighting, dark clean studio environment, premium product showcase, octane render 8k',
    'minimalist-scandinavian': 'minimalist Scandinavian product visual, soft diffused natural light, warm beige tones, clean negative space, premium organic aesthetic',
    'neon-bold': 'vibrant bold commercial, high contrast pop colors, electric rim lighting, dynamic advertising poster composition, punchy modern look'
  };

  if (styleKeywords[style] && !styledPrompt.toLowerCase().includes('lighting') && !styledPrompt.toLowerCase().includes('photography')) {
    styledPrompt = `${styledPrompt}, ${styleKeywords[style]}`;
  }

  try {
    // -------------------------------------------------------------
    // Provider 1: OpenAI DALL-E 3
    // -------------------------------------------------------------
    if (targetProvider === 'openai') {
      const apiKey = customKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        return res.end(
          JSON.stringify({
            error: 'OpenAI API key not configured. Please provide a key in Brand & API Settings or set OPENAI_API_KEY on the server.',
            provider: 'OpenAI DALL-E 3',
            needsCredentials: true
          })
        );
      }

      // DALL-E 3 dimensions must be 1024x1024, 1024x1792, or 1792x1024
      let size = '1024x1024';
      if (safeH > safeW * 1.2) size = '1024x1792';
      else if (safeW > safeH * 1.2) size = '1792x1024';

      const response = await postJson(
        'https://api.openai.com/v1/images/generations',
        {
          model: 'dall-e-3',
          prompt: styledPrompt,
          n: 1,
          size,
          quality: 'standard',
          response_format: 'b64_json'
        },
        { Authorization: `Bearer ${apiKey}` }
      );

      const b64 = response.data.data?.[0]?.b64_json;
      const revisedPrompt = response.data.data?.[0]?.revised_prompt || styledPrompt;

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(
        JSON.stringify({
          success: true,
          imageUrl: `data:image/png;base64,${b64}`,
          provider: 'OpenAI',
          model: 'dall-e-3',
          prompt: revisedPrompt,
          width: safeW,
          height: safeH,
          elapsed: ((Date.now() - startTime) / 1000).toFixed(2)
        })
      );
    }

    // -------------------------------------------------------------
    // Provider 2: Stability AI (SD3 / Core)
    // -------------------------------------------------------------
    if (targetProvider === 'stability') {
      const apiKey = customKey || process.env.STABILITY_API_KEY;
      if (!apiKey) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        return res.end(
          JSON.stringify({
            error: 'Stability AI API key not configured. Please provide a key in Brand & API Settings or set STABILITY_API_KEY on the server.',
            provider: 'Stability AI',
            needsCredentials: true
          })
        );
      }

      // Calculate closest aspect ratio
      const ratio = safeW / safeH;
      let aspectRatio = '1:1';
      if (ratio <= 0.6) aspectRatio = '9:16';
      else if (ratio <= 0.8) aspectRatio = '4:5';
      else if (ratio >= 1.6) aspectRatio = '16:9';
      else if (ratio >= 1.2) aspectRatio = '5:4';

      const response = await postJson(
        'https://api.stability.ai/v2beta/stable-image/generate/core',
        {
          prompt: styledPrompt,
          negative_prompt: negativePrompt || undefined,
          aspect_ratio: aspectRatio,
          output_format: 'png',
          seed
        },
        {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json'
        }
      );

      const imageB64 = response.data.image;
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(
        JSON.stringify({
          success: true,
          imageUrl: `data:image/png;base64,${imageB64}`,
          provider: 'Stability AI',
          model: 'stable-image-core',
          prompt: styledPrompt,
          width: safeW,
          height: safeH,
          seed,
          elapsed: ((Date.now() - startTime) / 1000).toFixed(2)
        })
      );
    }

    // -------------------------------------------------------------
    // Provider 3: Google Imagen 3 via Gemini API
    // -------------------------------------------------------------
    if (targetProvider === 'gemini') {
      const apiKey = customKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        return res.end(
          JSON.stringify({
            error: 'Google Gemini / Imagen API key not configured. Please provide a key in Brand & API Settings or set GEMINI_API_KEY on the server.',
            provider: 'Google Imagen 3',
            needsCredentials: true
          })
        );
      }

      const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
      const response = await postJson(imagenUrl, {
        instances: [{ prompt: styledPrompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: safeH > safeW * 1.2 ? '9:16' : safeW > safeH * 1.2 ? '16:9' : '1:1',
          outputMimeType: 'image/jpeg'
        }
      });

      const b64 = response.data.predictions?.[0]?.bytesBase64Encoded;
      if (!b64) {
        throw new Error('Imagen 3 did not return image data');
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(
        JSON.stringify({
          success: true,
          imageUrl: `data:image/jpeg;base64,${b64}`,
          provider: 'Google DeepMind',
          model: 'imagen-3.0-generate-002',
          prompt: styledPrompt,
          width: safeW,
          height: safeH,
          seed,
          elapsed: ((Date.now() - startTime) / 1000).toFixed(2)
        })
      );
    }

    // -------------------------------------------------------------
    // Provider 4: Public Cloud FLUX.1 Engine (Default / Zero-Config)
    // Runs real Black Forest Labs FLUX.1-schnell model on public cloud inference.
    // -------------------------------------------------------------
    const encodedPrompt = encodeURIComponent(styledPrompt);
    // Pollinations FLUX.1 endpoint delivers authentic 100% watermark-free photorealistic output
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${safeW}&height=${safeH}&seed=${seed}&nologo=true&model=flux`;

    const imgBuffer = await fetchBuffer(pollinationsUrl, {
      headers: {
        'User-Agent': 'FluxWebP-Poster-Studio/2.4'
      }
    });

    if (!imgBuffer || imgBuffer.length < 1000) {
      throw new Error('Generated image buffer is empty or corrupted');
    }

    // Detect format
    let mimeType = 'image/jpeg';
    if (imgBuffer[0] === 0x89 && imgBuffer[1] === 0x50 && imgBuffer[2] === 0x4e && imgBuffer[3] === 0x47) {
      mimeType = 'image/png';
    } else if (imgBuffer[0] === 0x52 && imgBuffer[1] === 0x49 && imgBuffer[2] === 0x46 && imgBuffer[3] === 0x46) {
      mimeType = 'image/webp';
    }

    const dataUrl = `data:${mimeType};base64,${imgBuffer.toString('base64')}`;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        success: true,
        imageUrl: dataUrl,
        provider: 'FLUX.1 Cloud Engine',
        model: 'black-forest-labs/FLUX.1-schnell',
        prompt: styledPrompt,
        width: safeW,
        height: safeH,
        seed,
        elapsed: ((Date.now() - startTime) / 1000).toFixed(2)
      })
    );
  } catch (err) {
    console.error('AI Poster Generation Error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        success: false,
        error: err.message || 'Generation failed',
        provider: targetProvider
      })
    );
  }
};

