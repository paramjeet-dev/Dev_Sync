const http = require('http');
const app = require('./app');
const config = require('./config/env');
const connectDB = require('./config/db');
const initSocketServer = require('./sockets');

async function start() {
  await connectDB();

  const httpServer = http.createServer(app);
  initSocketServer(httpServer);

  httpServer.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] Dev-Sync backend listening on port ${config.port} (${config.nodeEnv})`);
  });

  const shutdown = (signal) => {
    // eslint-disable-next-line no-console
    console.log(`[server] Received ${signal}, shutting down gracefully...`);
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[server] Failed to start:', err);
  process.exit(1);
});
