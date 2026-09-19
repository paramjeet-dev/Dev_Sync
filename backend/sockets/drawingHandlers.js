const { saveSnapshot } = require('../services/sessionService');

/**
 * Validates a minimal drawing payload shape. Kept intentionally loose since
 * the exact stroke representation is a client-side rendering concern (see
 * TRD section 4 — payload shape is conceptual, not contractual).
 */
function isValidDrawingPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (!payload.type || typeof payload.type !== 'string') return false;
  return true;
}

function registerDrawingHandlers(io, socket) {
  // Covers stroke-start / stroke-update / stroke-end via a single generic
  // event type field, so the client can send whichever phase it's in.
  socket.on('drawing:event', (payload) => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return; // must have joined a session first
    if (!isValidDrawingPayload(payload)) return;

    const enriched = {
      ...payload,
      sessionId,
      userId: socket.user.id,
      username: socket.user.username,
      socketId: socket.id,
      ts: Date.now(),
    };

    // Broadcast to everyone else in the room — the sender already rendered
    // its own stroke locally, so it is excluded (see IMPLEMENTATION_FLOW.md
    // Phase 4 "Implementation Concern").
    socket.to(sessionId).emit('drawing:event', enriched);
  });

  // Clear canvas for everyone (e.g. a toolbar "clear" action).
  socket.on('drawing:clear', () => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return;
    socket.to(sessionId).emit('drawing:clear', {
      userId: socket.user.id,
      username: socket.user.username,
    });
  });

  // Optional whiteboard snapshot persistence (APP_FLOW.md section 13 /
  // Session model canvasSnapshot). Client can periodically or on-demand
  // request a snapshot save so a reconnecting client can restore state.
  socket.on('drawing:snapshot:save', async ({ dataUrl } = {}, ack) => {
    const sessionId = socket.data.sessionId;
    if (!sessionId || !dataUrl) return ack?.({ ok: false });
    try {
      await saveSnapshot(sessionId, dataUrl);
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ ok: false, error: 'Failed to save snapshot.' });
    }
  });
}

module.exports = { registerDrawingHandlers };
