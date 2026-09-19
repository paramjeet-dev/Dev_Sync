const presenceStore = require('./presenceStore');

// Server-side throttle as a safety net in addition to client-side throttling
// (TRD section 15: "Consider throttling cursor movement").
const CURSOR_BROADCAST_INTERVAL_MS = 40; // ~25 updates/sec max per socket

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
