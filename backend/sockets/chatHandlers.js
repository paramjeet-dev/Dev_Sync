const { createMessage } = require('../services/chat/chatService');

function registerChatHandlers(io, socket) {
  socket.on('chat:send', async ({ message } = {}, ack) => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) {
      return ack?.({ ok: false, error: 'You must join a session first.' });
    }

    try {
      // Persist the canonical message before broadcasting.
      const saved = await createMessage({
        sessionId,
        userId: socket.user.id,
        username: socket.user.username,
        message,
      });

      ack?.({ ok: true, message: saved });
      io.to(sessionId).emit('chat:message', saved);
    } catch (err) {
      // Only validation errors (4xx) are safe to show; everything else is logged, not leaked.
      const safe = err.statusCode && err.statusCode < 500 ? err.message : null;
      if (!safe) {
        // eslint-disable-next-line no-console
        console.error('[chat] send failed:', err);
      }
      ack?.({ ok: false, error: safe || 'Failed to send message.' });
    }
  });
}

module.exports = { registerChatHandlers };
