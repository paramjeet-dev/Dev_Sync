const { saveSnapshot } = require('../services/sessionService');

/**
 * A "scene update" payload is a batch of changed/new Excalidraw elements
 * (not the whole scene) plus any new binary files (images) referenced by
 * those elements. Each element carries its own `id` and `version` — the
 * receiving client (and the persisted snapshot) resolve conflicts by
 * keeping the higher version per element id, matching Excalidraw's own
 * reference collaboration approach.
 */
function isValidScenePayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (!Array.isArray(payload.elements)) return false;
  return true;
}

function registerDrawingHandlers(io, socket) {
  socket.on('scene:update', (payload) => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return; // must have joined a session first
    if (!isValidScenePayload(payload)) return;

    const enriched = {
      elements: payload.elements,
      files: payload.files || {},
      userId: socket.user.id,
      username: socket.user.username,
      socketId: socket.id,
      ts: Date.now(),
    };

    // Broadcast to everyone else in the room — the sender already applied
    // this change to its own local scene (see IMPLEMENTATION_FLOW.md
    // Phase 4 "Implementation Concern").
    socket.to(sessionId).emit('scene:update', enriched);
  });

  // Full-scene clear (toolbar "clear canvas" action).
  socket.on('scene:clear', () => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return;
    socket.to(sessionId).emit('scene:clear', {
      userId: socket.user.id,
      username: socket.user.username,
    });
  });

  // Periodic/on-demand persistence so a reconnecting client (or one joining
  // mid-session) can restore the whiteboard (APP_FLOW.md section 13).
  // Server-side merge by element version makes this safe even if multiple
  // clients save around the same time (see sessionService.saveSnapshot).
  socket.on('scene:snapshot:save', async ({ elements, files } = {}, ack) => {
    const sessionId = socket.data.sessionId;
    if (!sessionId || !Array.isArray(elements)) return ack?.({ ok: false });
    try {
      await saveSnapshot(sessionId, { elements, files: files || {} });
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ ok: false, error: 'Failed to save snapshot.' });
    }
  });
}

module.exports = { registerDrawingHandlers };
