const presenceStore = require('./presenceStore');
const { touchSession, getSessionBySessionId } = require('../services/sessionService');

function registerPresenceHandlers(io, socket) {
  socket.on('session:join', async ({ sessionId }, ack) => {
    try {
      if (!sessionId || typeof sessionId !== 'string') {
        return ack?.({ ok: false, error: 'A valid sessionId is required.' });
      }

      const session = await getSessionBySessionId(sessionId);
      if (!session) {
        return ack?.({ ok: false, error: 'Session does not exist.' });
      }

      // A socket only ever belongs to one collaboration room at a time.
      socket.join(sessionId);
      socket.data.sessionId = sessionId;

      const participant = presenceStore.addParticipant(sessionId, socket.id, {
        userId: socket.user.id,
        username: socket.user.username,
      });

      const participants = presenceStore.getParticipants(sessionId);

      // Confirm join state directly to the joining client...
      ack?.({
        ok: true,
        sessionId,
        self: { socketId: socket.id, ...participant },
        participants,
      });

      // ...and broadcast the updated presence list to everyone else in the room.
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
