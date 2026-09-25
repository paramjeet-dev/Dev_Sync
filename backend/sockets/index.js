const { Server } = require('socket.io');
const config = require('../config/env');
const socketAuthMiddleware = require('./socketAuth');
const { registerPresenceHandlers } = require('./presenceHandlers');
const { registerDrawingHandlers } = require('./drawingHandlers');
const { registerCursorHandlers } = require('./cursorHandlers');
const { registerChatHandlers } = require('./chatHandlers');

function initSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: config.clientOrigin,
      credentials: true,
    },
    // Default is 1MB; scene payloads carrying embedded images (Excalidraw
    // image elements) can exceed that, so raise it. Still bounded to guard
    // against abuse — matches the transcription upload ceiling in spirit.
    maxHttpBufferSize: 10 * 1024 * 1024,
  });

  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    // eslint-disable-next-line no-console
    console.log(`[socket] Connected: ${socket.id} (user: ${socket.user.username})`);

    socket.data.sessionId = null;

    registerPresenceHandlers(io, socket);
    registerDrawingHandlers(io, socket);
    registerCursorHandlers(io, socket);
    registerChatHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      // eslint-disable-next-line no-console
      console.log(`[socket] Disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}

module.exports = initSocketServer;
