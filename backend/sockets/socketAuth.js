const { verifyToken } = require('../services/auth/tokenService');

/**
 * Socket.IO middleware: authenticates the connecting client using the JWT
 * issued at login. Token can arrive via the `auth` payload (recommended,
 * used by the frontend socket client) or an `Authorization` header.
 */
function socketAuthMiddleware(socket, next) {
  try {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers?.authorization || '').replace('Bearer ', '');

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
