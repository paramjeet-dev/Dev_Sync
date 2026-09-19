const mongoose = require('mongoose');
const config = require('./env');

async function connectDB() {
  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(config.mongodbUri);
    // eslint-disable-next-line no-console
    console.log(`[db] Connected to MongoDB at ${maskUri(config.mongodbUri)}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[db] MongoDB connection failed:', err.message);
    process.exit(1);
  }

  mongoose.connection.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[db] MongoDB connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    // eslint-disable-next-line no-console
    console.warn('[db] MongoDB disconnected');
  });
}

function maskUri(uri) {
  // Hides credentials in logs if present: mongodb://user:pass@host
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
}

module.exports = connectDB;
