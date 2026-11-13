/**
 * FluxWebP Pro — AI Prompt Enhancement & Creative Copy Engine
 * Route: /api/enhance-prompt
 */

const CATEGORY_VOCABULARY = {
  'product-advertising': {
    compositions: ['heroic center placement on a textured stone pedestal', 'floating dynamic 3D angle with subtle soft drop shadow', 'isometric studio showcase with pristine negative space for typography'],
    lightings: ['dual studio softbox setup with subtle rim backlight', 'dramatic high-contrast edge lighting', 'warm morning daylight through frosted architectural window'],
    materials: ['matte satin finish, ultra-fine microscopic surface textures', 'glossy specular reflections, pristine unblemished product details']
  },
  'machinery-industrial': {
    compositions: ['monumental low-angle perspective, imposing scale', 'precision exploded component framing with technical schematics aesthetic', 'clean modern factory showroom floor with epoxy floor reflections'],
    lightings: ['dramatic cool industrial spotlights, high dynamic range metallic highlights', 'clean overhead LED linear lighting with deep directional shadows'],
    materials: ['heavy machined billet steel, brushed titanium components, carbon fiber weaves, laser-etched serials']
  },
  'luxury-branding': {
    compositions: ['minimalist high-fashion editorial layout, ample serene breathing room', 'draped silk and Nero Marquina marble architectural podium', 'shallow depth of field with creamy bokeh and golden ratio placement'],
    lightings: ['soft wrap-around beauty dish lighting with gentle warm bounce', 'moody chiaroscuro illumination with gleaming 24k gold leaf highlights'],
    materials: ['polished obsidian, champagne gold hardware, hand-stitched fine leather, crystalline facets']
  },
  'technology-saas': {
    compositions: ['futuristic holographic interface backdrop, sleek dark glass pedestal', 'abstract glowing fiber optic data streams flanking the central hero', 'clean floating perspective with subtle isometric grid alignment'],
    lightings: ['bi-color cyan and deep violet volumetric laser accents', 'subtle ambient neon glows illuminating metallic edges against deep space slate'],
    materials: ['matte dark polycarbonate, micro-grooved silicon textures, translucent optical glass']
  },
  'food-restaurant': {
    compositions: ['overhead flat-lay with organic culinary ingredients', 'close-up 45-degree angle showcasing mouth-watering steam and texture', 'rustic dark wood table setting with soft linen and warm candlelight'],
    lightings: ['warm appetizing golden backlight highlighting glaze and moisture', 'diffused daylight with rich natural color vibrancy'],
    materials: ['glistening glaze, crisp artisan crust, fresh dew drops on micro-herbs, rich melting textures']
  }
};

const HEADLINE_SUGGESTIONS = {
  'product-advertising': ['ENGINEERED FOR PERFECTION', 'UNCOMPROMISING PRECISION', 'THE NEXT STANDARD', 'CRAFTED TO EXCEL'],
  'machinery-industrial': ['INDUSTRIAL POWER REDEFINED', 'UNRIVALED MECHANICAL MIGHT', 'PRECISION IN MOTION', 'BUILT FOR THE EXTREME'],
  'luxury-branding': ['TIMELESS REFINEMENT', 'THE EPITOME OF ELEGANCE', 'BEYOND LUXURY', 'DEFINING EXCLUSIVITY'],
  'technology-saas': ['POWERING THE FUTURE', 'SEAMLESS INTELLIGENCE', 'INTELLIGENT WORKFLOWS', 'NEXT-GEN ARCHITECTURE'],
  'food-restaurant': ['AN UNFORGETTABLE TASTE', 'ARTISAN FLAVORS', 'CRAFTED WITH PASSION', 'SAVOR THE EXTRAORDINARY']
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

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
    prompt = '',
    subject = '',
    category = 'product-advertising',
    style = 'commercial-advertising',
    mood = 'premium',
    lighting = 'studio-softbox',
    colorPalette = 'corporate-navy',
    composition = 'heroic-center'
  } = body;

  const vocab = CATEGORY_VOCABULARY[category] || CATEGORY_VOCABULARY['product-advertising'];
  const baseSubject = (subject || prompt || 'product advertisement').trim();

  // Construct structured commercial advertising prompt
  const randComp = vocab.compositions[Math.floor(Math.random() * vocab.compositions.length)];
  const randLight = vocab.lightings[Math.floor(Math.random() * vocab.lightings.length)];
  const randMat = vocab.materials[Math.floor(Math.random() * vocab.materials.length)];

  const enhancedPrompt = [
    `Masterpiece commercial poster visual of ${baseSubject}`,
    `Style: ${style.replace(/-/g, ' ')}, ${mood} mood`,
    `Composition: ${randComp}`,
    `Lighting: ${randLight}`,
    `Materials & Surface: ${randMat}`,
    `Color palette: ${colorPalette.replace(/-/g, ' ')}`,
    `Technical: professional commercial photography, 8k resolution, Hasselblad H6D-100c medium format, razor sharp focus, volumetric depth, pristine clean negative space designed for advertising typography, award-winning Cannes Lions visual direction`
  ].join(', ');

  const negativePrompt = 'distorted anatomy, low resolution, blurry, grainy, oversaturated, deformed edges, bad typography, artifacts, watermark, jpeg compression, amateur, noisy, cropped';

  const headlines = HEADLINE_SUGGESTIONS[category] || HEADLINE_SUGGESTIONS['product-advertising'];
  const suggestedHeadline = headlines[Math.floor(Math.random() * headlines.length)];

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  return res.end(
    JSON.stringify({
      success: true,
      originalPrompt: prompt,
      enhancedPrompt,
      negativePrompt,
      suggestedHeadline,
      suggestedSubtitle: 'Engineered with cutting-edge technology for discerning professionals.',
      suggestedCta: 'EXPLORE THE COLLECTION',
      category,
      style
    })
  );
};
