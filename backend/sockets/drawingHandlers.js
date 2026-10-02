const { persistSceneDelta, sanitizeElements, sanitizeFiles, clearScene } = require('../services/sceneService');
const { touchSessionThrottled } = require('../services/sessionService');

function logPersistError(sessionId, err) {
  // eslint-disable-next-line no-console
  console.error(`[scene] failed to persist update for ${sessionId}:`, err);
}

function registerDrawingHandlers(io, socket) {
  // A scene update is a batch of changed/new Excalidraw elements plus any new image files.
  // The server is the single place that persists the board: every delta it relays is also written
  // to the database (atomically, only if the version is newer), so clients never upload snapshots.
  socket.on('scene:update', (payload) => {
    const sessionId = socket.data.sessionId; // only set after a membership-checked join
    if (!sessionId) return;
    if (!payload || typeof payload !== 'object') return;

    const elements = sanitizeElements(payload.elements);
    const files = sanitizeFiles(payload.files);
    if (elements.length === 0 && Object.keys(files).length === 0) return;

    // Relay first for latency; the sender already applied the change locally.
    socket.to(sessionId).emit('scene:update', {
      elements,
      files,
      userId: socket.user.id,
      username: socket.user.username,
      socketId: socket.id,
      ts: Date.now(),
    });

    persistSceneDelta(sessionId, { elements, files }).catch((err) => logPersistError(sessionId, err));
    touchSessionThrottled(sessionId).catch(() => {});
  });

  // Full-scene clear. Also wipes the persisted scene so the old board doesn't reappear.
  socket.on('scene:clear', async () => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return;
    socket.to(sessionId).emit('scene:clear', {
      userId: socket.user.id,
      username: socket.user.username,
    });
    try {
      await clearScene(sessionId);
    } catch (err) {
      logPersistError(sessionId, err);
    }
  });
}

module.exports = { registerDrawingHandlers };
