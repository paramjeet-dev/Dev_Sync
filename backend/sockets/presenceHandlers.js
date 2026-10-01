const presenceStore = require('./presenceStore');
const { touchSession, addMember, getSessionBySessionId } = require('../services/sessionService');

function registerPresenceHandlers(io, socket) {
  socket.on('session:join', async ({ sessionId } = {}, ack) => {
    try {
      if (!sessionId || typeof sessionId !== 'string') {
        return ack?.({ ok: false, error: 'A valid sessionId is required.' });
      }

      const session = await getSessionBySessionId(sessionId);
      if (!session) {
        return ack?.({ ok: false, error: 'Session does not exist.' });
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

      // Bump activity and record membership so the board shows in "Your boards".
      await Promise.all([touchSession(sessionId), addMember(sessionId, socket.user.id)]);
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
