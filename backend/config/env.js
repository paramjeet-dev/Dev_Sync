require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    // eslint-disable-next-line no-console
    console.warn(`[config] Warning: environment variable ${name} is not set.`);
  }
  return value;
}

const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',

  mongodbUri: required('MONGODB_URI', 'mongodb://localhost:27017/dev-sync'),

  jwtSecret: required('JWT_SECRET', 'dev-only-insecure-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieName: process.env.COOKIE_NAME || 'dev_sync_token',

  openaiApiKey: process.env.OPENAI_API_KEY || '',

  maxAudioSizeMb: parseInt(process.env.MAX_AUDIO_SIZE_MB || '25', 10),
};

module.exports = config;
