const crypto = require('crypto');
const mongoose = require('mongoose');
const Session = require('../models/Session');
const ChatMessage = require('../models/ChatMessage');
const scene = require('./sceneService');

const toObjectId = (id) => new mongoose.Types.ObjectId(id);

function memberFilter(sessionId, userId) {
  const uid = toObjectId(userId);
  return { sessionId, $or: [{ members: uid }, { createdBy: uid }] };
}

// 12 hex chars (48 bits). The room code works like a password, so it must be hard to guess.
// Boards created earlier keep their shorter codes.
function generateSessionId() {
  return crypto.randomBytes(6).toString('hex');
}

async function createSession({ name, createdBy }) {
  let sessionId = generateSessionId();

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
  return Session.findOne({ sessionId });
}

/** True if the user created the board or has joined it with the room code. */
async function isMember(sessionId, userId) {
  if (typeof sessionId !== 'string' || !sessionId) return false;
  return !!(await Session.exists(memberFilter(sessionId, userId)));
}

/**
 * Joining = presenting the room code. Idempotent. Returns the session, or null if no such board.
 */
async function joinSession(sessionId, userId) {
  if (typeof sessionId !== 'string' || !sessionId) return null;
  const session = await Session.findOneAndUpdate(
    { sessionId },
    { $addToSet: { members: toObjectId(userId) }, $set: { lastActivityAt: new Date() } },
    { new: true }
  );
  return session ? session.toPublicJSON() : null;
}

async function touchSession(sessionId) {
  await Session.updateOne({ sessionId }, { $set: { lastActivityAt: new Date() } });
}

// Scene deltas arrive many times a second; bump lastActivityAt at most once per interval per board.
const lastTouch = new Map();
function touchSessionThrottled(sessionId, intervalMs = 30000) {
  const now = Date.now();
  if (now - (lastTouch.get(sessionId) || 0) < intervalMs) return Promise.resolve();
  lastTouch.set(sessionId, now);
  return touchSession(sessionId);
}

// Boards the user created or joined, newest activity first. Never loads scene data.
async function listSessionsForUser(userId, limit = 50) {
  const uid = toObjectId(userId);
  const sessions = await Session.aggregate([
    { $match: { $or: [{ members: uid }, { createdBy: uid }] } },
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
        thumbnail: 1,
        memberCount: { $max: [1, { $size: { $ifNull: ['$members', []] } }] },
      },
    },
  ]);

  const counts = await scene.countVisibleElements(sessions.map((s) => s.sessionId));
  return sessions.map((s) => ({ ...s, elementCount: counts.get(s.sessionId) || 0 }));
}

/**
 * Creator -> permanently deletes the board, its chat and its scene.
 * Other member -> removes the board from their own list only.
 * Returns { result: 'deleted' | 'removed' | 'not_found' }.
 */
async function deleteSessionForUser(sessionId, userId) {
  const session = await Session.findOne({ sessionId }).select('createdBy members');
  if (!session) return { result: 'not_found' };

  const uid = String(userId);
  if (session.createdBy.toString() === uid) {
    await Promise.all([
      Session.deleteOne({ sessionId }),
      ChatMessage.deleteMany({ sessionId }),
      scene.clearScene(sessionId),
    ]);
    lastTouch.delete(sessionId);
    return { result: 'deleted' };
  }

  if (!session.members.some((m) => m.toString() === uid)) return { result: 'not_found' };
  await Session.updateOne({ sessionId }, { $pull: { members: toObjectId(uid) } });
  return { result: 'removed' };
}

// Only the creator can rename. Returns { result: 'ok' | 'forbidden' | 'not_found' }.
async function renameSession(sessionId, userId, name) {
  const session = await Session.findOne({ sessionId }).select('createdBy');
  if (!session) return { result: 'not_found' };
  if (session.createdBy.toString() !== String(userId)) return { result: 'forbidden' };
  await Session.updateOne({ sessionId }, { $set: { name } });
  return { result: 'ok', name };
}

// Members/creator only. Deliberately does not bump lastActivityAt (so it can't reorder the lobby).
async function setThumbnail(sessionId, userId, thumbnail) {
  const res = await Session.updateOne(memberFilter(sessionId, userId), { $set: { thumbnail } });
  return res.matchedCount > 0;
}

module.exports = {
  createSession,
  getSessionBySessionId,
  isMember,
  joinSession,
  touchSession,
  touchSessionThrottled,
  listSessionsForUser,
  deleteSessionForUser,
  renameSession,
  setThumbnail,
  getSnapshot: scene.getSnapshot,
  clearScene: scene.clearScene,
};
