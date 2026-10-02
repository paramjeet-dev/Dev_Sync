const presenceStore = require('./presenceStore');
const { touchSession, isMember } = require('../services/sessionService');

function registerPresenceHandlers(io, socket) {
  socket.on('session:join', async ({ sessionId } = {}, ack) => {
    try {
      if (!sessionId || typeof sessionId !== 'string') {
        return ack?.({ ok: false, error: 'A valid sessionId is required.' });
      }

      // Membership is granted by joining over HTTP with the room code (POST /sessions/:id/join).
      // Same message for "no such board" and "not a member" so boards can't be probed.
      if (!(await isMember(sessionId, socket.user.id))) {
        return ack?.({ ok: false, error: 'Board not found, or you do not have access to it.' });
      }

      socket.join(sessionId);
      socket.data.sessionId = sessionId;

      const participant = presenceStore.addParticipant(sessionId, socket.id, {
        userId: socket.user.id,
        username: socket.user.username,
      });

      const participants = presenceStore.getParticipants(sessionId);

      ack?.({
        ok: true,
        sessionId,
        self: { socketId: socket.id, ...participant },
        participants,
      });

      socket.to(sessionId).emit('presence:update', { participants });

      await touchSession(sessionId);
    } catch (err) {
      ack?.({ ok: false, error: 'Failed to join session.' });
    }
  });

  socket.on('session:leave', () => {
    handleLeave(io, socket);
  });

  socket.on('disconnect', () => {
    handleLeave(io, socket);
  });
}

function handleLeave(io, socket) {
  const sessionId = socket.data.sessionId;
  if (!sessionId) return;

  presenceStore.removeParticipant(sessionId, socket.id);
  socket.leave(sessionId);
  socket.data.sessionId = null;

  const participants = presenceStore.getParticipants(sessionId);
  io.to(sessionId).emit('presence:update', { participants });
  io.to(sessionId).emit('presence:user-left', {
    socketId: socket.id,
    userId: socket.user?.id,
    username: socket.user?.username,
  });
}

module.exports = { registerPresenceHandlers };
