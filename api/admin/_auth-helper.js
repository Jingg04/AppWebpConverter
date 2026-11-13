// api/admin/_auth-helper.js
const crypto = require('crypto');

const AUTH_SECRET = process.env.FLUX_ADMIN_SECRET || process.env.SESSION_SECRET || 'fluxwebp-production-secret-2026-key';
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'fluxwebp2026!pro';

function signToken(payload) {
  const data = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(data).digest('hex');
  return Buffer.from(data).toString('base64url') + '.' + sig;
}

function verifyToken(tokenString) {
  if (!tokenString || typeof tokenString !== 'string') return null;
  const parts = tokenString.split('.');
  if (parts.length !== 2) return null;

  const [b64Data, signature] = parts;
  try {
    const data = Buffer.from(b64Data, 'base64url').toString('utf8');
    const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(data).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }
    const payload = JSON.parse(data);
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function getSession(req) {
  // Check Authorization Bearer header
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    const session = verifyToken(authHeader.slice(7));
    if (session) return session;
  }

  // Check HttpOnly Cookie
  const cookies = req.headers['cookie'] || '';
  const match = cookies.match(/(?:^|;\s*)flux_admin_session=([^;]+)/);
  if (match) {
    const session = verifyToken(match[1]);
    if (session) return session;
  }

  return null;
}

module.exports = {
  ADMIN_PASSCODE,
  signToken,
  verifyToken,
  getSession
};

