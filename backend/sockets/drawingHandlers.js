const { saveSnapshot, clearSnapshot, isAcceptableImageFile } = require('../services/sessionService');

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

/**
 * Server-side re-validation of incoming files, independent of whatever the
 * sending client already filtered. This is the real trust boundary — the
 * frontend's own size/type check (useExcalidrawSync.js) is only a UX
 * nicety and could be bypassed by a modified client or a hand-crafted
 * socket event, which would otherwise let one connection push an
 * arbitrarily large payload at every other peer in the room in real time,
 * independent of whether it ever gets persisted.
 */
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
    if (!sessionId) return; // must have joined a session first
    if (!isValidScenePayload(payload)) return;

    const enriched = {
      elements: payload.elements,
      files: filterAcceptableFiles(payload.files),
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

  // Full-scene clear (toolbar "clear canvas" action). Clears the persisted
  // snapshot too, not just the connected clients' in-memory scenes —
  // otherwise the pre-clear board silently reappears for the next client
  // that joins or refreshes (see sessionService.clearSnapshot).
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
      // Non-fatal for the live clear (clients already cleared their local
      // scenes); the next periodic snapshot save will simply re-persist
      // whatever state clients are in at that point.
    }
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
