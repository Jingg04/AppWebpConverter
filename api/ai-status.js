/**
 * FluxWebP Pro — AI Provider Status & Capabilities Inspector
 * Route: /api/ai-status
 */

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const providers = [
    {
      id: 'flux-community',
      name: 'FLUX.1 Cloud Engine',
      company: 'Black Forest Labs',
      model: 'black-forest-labs/FLUX.1-schnell',
      status: 'operational',
      configured: true,
      requiresKey: false,
      costType: 'Free Cloud Tier',
      description: 'Ultra-fast 12B parameter rectified flow transformer for photorealistic advertising posters.'
    },
    {
      id: 'gemini',
      name: 'Google Imagen 3',
      company: 'Google DeepMind',
      model: 'imagen-3.0-generate-002',
      status: process.env.GEMINI_API_KEY ? 'operational' : 'not_configured',
      configured: !!process.env.GEMINI_API_KEY,
      requiresKey: true,
      costType: 'API Quota',
      description: 'State-of-the-art text-to-image with superior prompt adherence and typography rendering.'
    },
    {
      id: 'openai',
      name: 'OpenAI DALL-E 3',
      company: 'OpenAI',
      model: 'dall-e-3',
      status: process.env.OPENAI_API_KEY ? 'operational' : 'not_configured',
      configured: !!process.env.OPENAI_API_KEY,
      requiresKey: true,
      costType: 'API Quota',
      description: 'Deep natural language understanding with vivid commercial compositions.'
    },
    {
      id: 'stability',
      name: 'Stability AI SD3',
      company: 'Stability AI',
      model: 'stable-image-core',
      status: process.env.STABILITY_API_KEY ? 'operational' : 'not_configured',
      configured: !!process.env.STABILITY_API_KEY,
      requiresKey: true,
      costType: 'API Quota',
      description: 'High-detail diffusion with multi-subject composition.'
    }
  ];

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  return res.end(
    JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      defaultProvider: 'flux-community',
      providers,
      byokSupported: true
    })
  );
};

