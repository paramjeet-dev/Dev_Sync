/**
 * In-memory presence tracking, keyed by sessionId -> Map<socketId, participant>.
 * This is intentionally NOT persisted to MongoDB — presence/cursor data is
 * transient per PRD section 5.2/5.3 and TRD section 5.
 *
 * For multi-instance/horizontal scaling, this store would need to be backed
 * by Redis (e.g. via socket.io-redis adapter) instead of process memory.
 */

const sessions = new Map(); // sessionId -> Map<socketId, participant>

function ensureSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, new Map());
  }
  return sessions.get(sessionId);
}

function addParticipant(sessionId, socketId, participant) {
  const room = ensureSession(sessionId);
  room.set(socketId, {
    ...participant,
    cursor: null,
    joinedAt: Date.now(),
  });
  return room.get(socketId);
}

function removeParticipant(sessionId, socketId) {
  const room = sessions.get(sessionId);
  if (!room) return null;
  const participant = room.get(socketId) || null;
  room.delete(socketId);
  if (room.size === 0) {
    sessions.delete(sessionId);
  }
  return participant;
}

function updateCursor(sessionId, socketId, cursor) {
  const room = sessions.get(sessionId);
  if (!room || !room.has(socketId)) return null;
  const participant = room.get(socketId);
  participant.cursor = cursor;
  return participant;
}

function getParticipants(sessionId) {
  const room = sessions.get(sessionId);
  if (!room) return [];
  return Array.from(room.entries()).map(([socketId, p]) => ({
    socketId,
    ...p,
  }));
}

function getParticipant(sessionId, socketId) {
  const room = sessions.get(sessionId);
  if (!room) return null;
  return room.get(socketId) || null;
}

function findSessionForSocket(socketId) {
  for (const [sessionId, room] of sessions.entries()) {
    if (room.has(socketId)) return sessionId;
  }
  return null;
}

module.exports = {
  addParticipant,
  removeParticipant,
  updateCursor,
  getParticipants,
  getParticipant,
  findSessionForSocket,
};
