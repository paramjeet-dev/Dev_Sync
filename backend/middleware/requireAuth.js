const { verifyToken } = require('../services/auth/tokenService');
const config = require('../config/env');

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  if (req.cookies && req.cookies[config.cookieName]) {
    return req.cookies[config.cookieName];
  }
  return null;
}

function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, username: payload.username };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

module.exports = { requireAuth, extractToken };
