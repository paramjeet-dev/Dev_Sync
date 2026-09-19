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

async function saveSnapshot(sessionId, dataUrl) {
  await Session.findOneAndUpdate(
    { sessionId },
    { $set: { canvasSnapshot: dataUrl, lastActivityAt: new Date() } },
    { upsert: false }
  );
}

async function getSnapshot(sessionId) {
  const session = await Session.findOne({ sessionId }).select('canvasSnapshot');
  return session ? session.canvasSnapshot : null;
}

module.exports = {
  createSession,
  getSessionBySessionId,
  touchSession,
  saveSnapshot,
  getSnapshot,
};
