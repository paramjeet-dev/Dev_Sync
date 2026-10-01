const presenceStore = require('./presenceStore');

// Server-side throttle is only a safety net (clients already throttle at 40ms).
// Kept looser than the client so timing jitter doesn't drop events.
const CURSOR_BROADCAST_INTERVAL_MS = 15;

function registerCursorHandlers(io, socket) {
  let lastBroadcast = 0;

  socket.on('cursor:move', ({ x, y } = {}) => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return;
    if (typeof x !== 'number' || typeof y !== 'number') return;

    presenceStore.updateCursor(sessionId, socket.id, { x, y });

    const now = Date.now();
    if (now - lastBroadcast < CURSOR_BROADCAST_INTERVAL_MS) return;
    lastBroadcast = now;

    socket.to(sessionId).emit('cursor:update', {
      socketId: socket.id,
      userId: socket.user.id,
      username: socket.user.username,
      x,
      y,
    });
  });
}

module.exports = { registerCursorHandlers };
