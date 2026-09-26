const crypto = require('crypto');
const Session = require('../models/Session');

// Kept identical to the frontend's own limits (frontend/src/hooks/
// useExcalidrawSync.js) so client-side rejection and server-side rejection
// agree — but this server-side check is the actual security boundary; the
// frontend one is only a UX nicety and can't be trusted on its own, since
// a modified client or a direct socket event could bypass it entirely.
const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB per image
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']);

function estimateDecodedBytes(dataURL) {
  if (typeof dataURL !== 'string') return Infinity;
  const commaIndex = dataURL.indexOf(',');
  const base64Length = commaIndex === -1 ? dataURL.length : dataURL.length - commaIndex - 1;
  return Math.floor(base64Length * 0.75);
}

function isAcceptableImageFile(file) {
  if (!file || typeof file !== 'object') return false;
  if (!file.mimeType || !ALLOWED_IMAGE_MIME_TYPES.has(file.mimeType)) return false;
  if (estimateDecodedBytes(file.dataURL) > MAX_IMAGE_BYTES) return false;
  return true;
}

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
 *
 * Incoming elements may be "tombstones" — Excalidraw represents a deletion
 * as the same element id with `isDeleted: true` and a bumped version,
 * rather than removing it from the array — so this merge is expected to
 * (and must) store those tombstones too, not just visible shapes. Dropping
 * them here would mean a deleted shape's last visible version stays
 * persisted forever and reappears on the next restore.
 */
async function saveSnapshot(sessionId, { elements = [], files = {} } = {}) {
  const session = await Session.findOne({ sessionId });
  if (!session) return;

  const merged = new Map((session.canvasElements || []).map((el) => [el.id, el]));
  elements.forEach((el) => {
    const existing = merged.get(el.id);
    // Strictly greater, not >=: an incoming element at the same version as
    // what's already stored is not newer information, so a same-version
    // save (e.g. two clients' periodic snapshot timers firing around the
    // same moment) shouldn't overwrite the existing copy or cause churn.
    if (!existing || (el.version ?? 0) > (existing.version ?? 0)) {
      merged.set(el.id, el);
    }
  });

  // Validate every incoming file server-side, independent of whatever the
  // client already filtered — this is the actual trust boundary. Anything
  // oversized or an unrecognized type is silently dropped from what gets
  // persisted rather than rejecting the whole snapshot save, since the
  // element data in the same payload is still legitimate and worth keeping.
  const acceptedFiles = {};
  Object.entries(files || {}).forEach(([fileId, file]) => {
    if (isAcceptableImageFile(file)) acceptedFiles[fileId] = file;
  });

  session.canvasElements = Array.from(merged.values());
  session.canvasFiles = { ...(session.canvasFiles || {}), ...acceptedFiles };
  session.lastActivityAt = new Date();
  await session.save();
}

async function getSnapshot(sessionId) {
  const session = await Session.findOne({ sessionId }).select('canvasElements canvasFiles');
  if (!session) return null;
  return { elements: session.canvasElements || [], files: session.canvasFiles || {} };
}

/**
 * Wipes the persisted scene entirely. Used when a client clears the board
 * (Toolbar "Clear" action) — without this, the in-memory scene clears for
 * everyone currently connected, but the pre-clear elements remain in
 * MongoDB and silently reappear for the next client that joins or
 * refreshes, since restore just replays whatever saveSnapshot last stored.
 */
async function clearSnapshot(sessionId) {
  await Session.findOneAndUpdate(
    { sessionId },
    { $set: { canvasElements: [], canvasFiles: {}, lastActivityAt: new Date() } }
  );
}

module.exports = {
  createSession,
  getSessionBySessionId,
  touchSession,
  saveSnapshot,
  getSnapshot,
  clearSnapshot,
  isAcceptableImageFile,
};
