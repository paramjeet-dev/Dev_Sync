const { saveSnapshot, clearSnapshot, isAcceptableImageFile } = require('../services/sessionService');

/**
 * A "scene update" payload is a batch of changed/new Excalidraw elements plus
 * any new binary files. Conflicts resolve by keeping the higher `version`.
 */
function isValidScenePayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (!Array.isArray(payload.elements)) return false;
  return true;
}

/** Server-side re-validation of incoming files (the real trust boundary). */
function filterAcceptableFiles(files) {
  const accepted = {};
  Object.entries(files || {}).forEach(([fileId, file]) => {
    if (isAcceptableImageFile(file)) accepted[fileId] = file;
  });
  return accepted;
}

function registerDrawingHandlers(io, socket) {
  socket.on('scene:update', (payload) => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return;
    if (!isValidScenePayload(payload)) return;

    const enriched = {
      elements: payload.elements,
      files: filterAcceptableFiles(payload.files),
      userId: socket.user.id,
      username: socket.user.username,
      socketId: socket.id,
      ts: Date.now(),
    };

    // Everyone else in the room; the sender already applied the change locally.
    socket.to(sessionId).emit('scene:update', enriched);
  });

  // Full-scene clear. Also clears the persisted snapshot so the old board
  // doesn't reappear for the next client that joins.
  socket.on('scene:clear', async () => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return;
    socket.to(sessionId).emit('scene:clear', {
      userId: socket.user.id,
      username: socket.user.username,
    });
    try {
      await clearSnapshot(sessionId);
    } catch (err) {
      // Non-fatal; the next periodic snapshot re-persists current state.
    }
  });

  // Periodic persistence so a reconnecting/late-joining client can restore the board.
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
