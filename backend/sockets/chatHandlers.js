const { createMessage } = require('../services/chat/chatService');

function registerChatHandlers(io, socket) {
  socket.on('chat:send', async ({ message } = {}, ack) => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) {
      return ack?.({ ok: false, error: 'You must join a session first.' });
    }

    try {
      // Persist the canonical message before broadcasting (IMPLEMENTATION_FLOW.md
      // Phase 8: "Persisting the canonical message before broadcast provides a
      // clear source of truth").
      const saved = await createMessage({
        sessionId,
        userId: socket.user.id,
        username: socket.user.username,
        message,
      });

      ack?.({ ok: true, message: saved });
      io.to(sessionId).emit('chat:message', saved);
    } catch (err) {
      ack?.({ ok: false, error: err.message || 'Failed to send message.' });
    }
  });
}

module.exports = { registerChatHandlers };
