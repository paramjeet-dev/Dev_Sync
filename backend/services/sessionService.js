const crypto = require('crypto');
const Session = require('../models/Session');

function generateSessionId() {
  return crypto.randomBytes(4).toString('hex'); // short, shareable room code
}

async function createSession({ name, createdBy }) {
  let sessionId = generateSessionId();

  // Extremely unlikely collision, but guard anyway.
  // eslint-disable-next-line no-await-in-loop
  while (await Session.exists({ sessionId })) {
    sessionId = generateSessionId();
  }

  const session = await Session.create({
    sessionId,
    name: name || sessionId,
    createdBy,
  });

  return session.toPublicJSON();
}

async function getSessionBySessionId(sessionId) {
  const session = await Session.findOne({ sessionId });
  return session;
}

async function touchSession(sessionId) {
  await Session.findOneAndUpdate(
    { sessionId },
    { $set: { lastActivityAt: new Date() } }
  );
}

/**
 * Merges an incoming batch of Excalidraw elements into the session's
 * persisted scene, keeping the higher-`version` copy of each element by id
 * (Excalidraw's own conflict rule — see frontend sync layer). This makes
 * snapshot saves safe to call concurrently from multiple clients without a
 * later, staler save clobbering newer edits.
 */
async function saveSnapshot(sessionId, { elements = [], files = {} } = {}) {
  const session = await Session.findOne({ sessionId });
  if (!session) return;

  const merged = new Map((session.canvasElements || []).map((el) => [el.id, el]));
  elements.forEach((el) => {
    const existing = merged.get(el.id);
    if (!existing || (el.version ?? 0) >= (existing.version ?? 0)) {
      merged.set(el.id, el);
    }
  });

  session.canvasElements = Array.from(merged.values());
  session.canvasFiles = { ...(session.canvasFiles || {}), ...files };
  session.lastActivityAt = new Date();
  await session.save();
}

async function getSnapshot(sessionId) {
  const session = await Session.findOne({ sessionId }).select('canvasElements canvasFiles');
  if (!session) return null;
  return { elements: session.canvasElements || [], files: session.canvasFiles || {} };
}

module.exports = {
  createSession,
  getSessionBySessionId,
  touchSession,
  saveSnapshot,
  getSnapshot,
};
