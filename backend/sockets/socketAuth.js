const { verifyToken } = require('../services/auth/tokenService');
const config = require('../config/env');

/**
 * Extracts a single named cookie's value from a raw `Cookie` header string.
 * Socket.IO's handshake gives us the header as-is (unlike Express, which
 * has cookie-parser already applied) — this is intentionally minimal
 * rather than pulling in a cookie-parsing dependency for one field.
 */
function readCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

/**
 * Socket.IO middleware: authenticates the connecting client using the same
 * httpOnly JWT cookie set at login/signup (see controllers/authController.js).
 * The token is intentionally never read from `handshake.auth` or an
 * `Authorization` header populated from client-side JS — doing so would
 * require the frontend to hold the raw token somewhere JS can read (e.g.
 * localStorage), which defeats the point of the cookie being httpOnly and
 * reintroduces XSS-token-theft exposure. The frontend socket client
 * connects with `withCredentials: true` and sends no token of its own; see
 * frontend/src/services/socket.js.
 */
function socketAuthMiddleware(socket, next) {
  try {
    const token = readCookie(socket.handshake.headers?.cookie, config.cookieName);

    if (!token) {
      return next(new Error('Authentication required.'));
    }

    const payload = verifyToken(token);
    socket.user = { id: payload.sub, username: payload.username };
    return next();
  } catch (err) {
    return next(new Error('Invalid or expired token.'));
  }
}

module.exports = socketAuthMiddleware;
