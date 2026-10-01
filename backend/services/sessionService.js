const crypto = require('crypto');
const mongoose = require('mongoose');
const Session = require('../models/Session');
const ChatMessage = require('../models/ChatMessage');

// Server-side image limits: the actual trust boundary (the frontend check is a UX nicety).
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
    members: [createdBy],
  });

  return session.toPublicJSON();
}

async function getSessionBySessionId(sessionId) {
  const session = await Session.findOne({ sessionId });
  return session;
}

async function touchSession(sessionId) {
  await Session.findOneAndUpdate({ sessionId }, { $set: { lastActivityAt: new Date() } });
}

// Records that a user has been in this board (idempotent).
async function addMember(sessionId, userId) {
  await Session.updateOne({ sessionId }, { $addToSet: { members: userId } });
}

// Boards the user created or joined, newest activity first.
// Never loads the heavy canvas payload — only the element count.
async function listSessionsForUser(userId, limit = 50) {
  const uid = new mongoose.Types.ObjectId(userId);
  return Session.aggregate([
    { $match: { $or: [{ members: uid }, { createdBy: uid }] } }, // createdBy keeps pre-existing boards visible
    { $sort: { lastActivityAt: -1 } },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        sessionId: 1,
        name: 1,
        createdBy: { $toString: '$createdBy' },
        createdAt: 1,
        lastActivityAt: 1,
        elementCount: { $size: { $ifNull: ['$canvasElements', []] } },
      },
    },
  ]);
}

/**
 * Creator -> permanently deletes the board and its chat history.
 * Anyone else -> removes the board from their own list only.
 * Returns { result: 'deleted' | 'removed' | 'not_found' }.
 */
async function deleteSessionForUser(sessionId, userId) {
  const session = await Session.findOne({ sessionId }).select('createdBy');
  if (!session) return { result: 'not_found' };

  if (session.createdBy.toString() === String(userId)) {
    await Promise.all([Session.deleteOne({ sessionId }), ChatMessage.deleteMany({ sessionId })]);
    return { result: 'deleted' };
  }

  await Session.updateOne({ sessionId }, { $pull: { members: new mongoose.Types.ObjectId(userId) } });
  return { result: 'removed' };
}

/**
 * Merges an incoming batch of Excalidraw elements into the persisted scene,
 * keeping the higher-`version` copy per element id. Tombstones (isDeleted)
 * are stored too, otherwise deleted shapes would reappear on restore.
 */
async function saveSnapshot(sessionId, { elements = [], files = {} } = {}) {
  const session = await Session.findOne({ sessionId });
  if (!session) return;

  const merged = new Map((session.canvasElements || []).map((el) => [el.id, el]));
  elements.forEach((el) => {
    const existing = merged.get(el.id);
    // Strictly greater: same-version saves are not newer information.
    if (!existing || (el.version ?? 0) > (existing.version ?? 0)) {
      merged.set(el.id, el);
    }
  });

  // Validate every incoming file server-side; drop bad ones, keep the elements.
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

// Wipes the persisted scene (used by the "Clear" action).
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
  addMember,
  listSessionsForUser,
  deleteSessionForUser,
  saveSnapshot,
  getSnapshot,
  clearSnapshot,
  isAcceptableImageFile,
};
