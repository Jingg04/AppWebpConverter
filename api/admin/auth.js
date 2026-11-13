// api/admin/auth.js
const { ADMIN_PASSCODE, signToken, getSession } = require('./_auth-helper');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  // GET: Check active authentication status
  if (req.method === 'GET') {
    const session = getSession(req);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      authenticated: !!session,
      user: session ? session.user : null,
      role: session ? session.role : null
    }));
  }

  // POST: Login / Logout
  if (req.method === 'POST') {
    let body = {};
    try {
      if (typeof req.body === 'object') {
        body = req.body;
      } else if (req.body) {
        body = JSON.parse(req.body);
      } else {
        const buffers = [];
        for await (const chunk of req) buffers.push(chunk);
        const data = Buffer.concat(buffers).toString();
        if (data) body = JSON.parse(data);
      }
    } catch (_) {}

    // Logout
    if (body.action === 'logout') {
      res.setHeader('Set-Cookie', 'flux_admin_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: true, message: 'Logged out successfully' }));
    }

    // Login verification
    const password = body.password || '';
    if (!password || password !== ADMIN_PASSCODE) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({
        success: false,
        error: 'Invalid administrative credentials'
      }));
    }

    // Generate signed session token (24 hour expiration)
    const token = signToken({
      user: 'admin',
      role: 'editor',
      iat: Date.now(),
      exp: Date.now() + 86400 * 1000
    });

    // Set HttpOnly, Secure, SameSite=Strict cookie
    res.setHeader('Set-Cookie', `flux_admin_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      success: true,
      message: 'Authentication successful',
      token
    }));
  }

  res.statusCode = 405;
  res.end('Method Not Allowed');
};
