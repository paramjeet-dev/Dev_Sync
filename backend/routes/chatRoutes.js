const express = require('express');
const { getHistory, postMessage } = require('../controllers/chatController');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

// GET /api/chat/:sessionId/messages?before=<ISO date>&limit=30
router.get('/:sessionId/messages', requireAuth, getHistory);

// POST /api/chat/:sessionId/messages  (HTTP fallback; sockets are primary path)
router.post('/:sessionId/messages', requireAuth, postMessage);

module.exports = router;
