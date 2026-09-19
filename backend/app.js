const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const config = require('./config/env');
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const transcriptionRoutes = require('./routes/transcriptionRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

app.use(
  cors({
    origin: config.clientOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' })); // covers canvas snapshot data URLs
app.use(cookieParser());
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/transcription', transcriptionRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
