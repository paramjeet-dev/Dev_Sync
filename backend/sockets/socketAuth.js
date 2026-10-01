const { verifyToken } = require('../services/auth/tokenService');
const config = require('../config/env');

/** Extracts a single named cookie's value from a raw `Cookie` header string. */
function readCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

/**
 * Socket.IO middleware: authenticates using the same httpOnly JWT cookie set
 * at login/signup. The token is never read from handshake.auth, so the
 * frontend never needs to hold the raw JWT in JS-readable storage.
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
