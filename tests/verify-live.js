// tests/verify-live.js
async function verifyLive() {
  const tests = [
    { url: 'https://app-webp-converter.vercel.app/', check: r => r.status === 200, name: 'Home Page' },
    { url: 'https://app-webp-converter.vercel.app/samnang.com.com.omg/', check: r => r.status === 200, name: 'Exclusive Admin Route' },
    { url: 'https://app-webp-converter.vercel.app/api/admin/auth', check: r => r.status === 200, name: 'Serverless Auth API' },
    { url: 'https://app-webp-converter.vercel.app/blog/', check: r => r.status === 200, name: 'Blog Knowledge Center' },
    { url: 'https://app-webp-converter.vercel.app/editor/', check: r => r.status === 200, name: 'Image Editor' },
    { url: 'https://app-webp-converter.vercel.app/background-remover/', check: r => r.status === 200, name: 'AI BG Remover' },
    { url: 'https://app-webp-converter.vercel.app/poster-studio/', check: r => r.status === 200, name: 'AI Poster Studio' }
  ];

  console.log('Testing live endpoints on https://app-webp-converter.vercel.app/ ...\n');
  for (const t of tests) {
    try {
      const res = await fetch(t.url);
      const passed = t.check(res);
      console.log(`[${passed ? 'PASS' : 'FAIL'}] ${t.name}: Status ${res.status} (${t.url})`);
    } catch(err) {
      console.log(`[ERR] ${t.name}: ${err.message}`);
    }
  }
}
verifyLive();
