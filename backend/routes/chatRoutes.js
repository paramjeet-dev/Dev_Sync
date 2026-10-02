const express = require('express');
const { getHistory, postMessage } = require('../controllers/chatController');
const { requireAuth } = require('../middleware/requireAuth');
const { requireMember } = require('../middleware/requireMember');

const router = express.Router();

// GET /api/chat/:sessionId/messages?before=<ISO date>&limit=30
router.get('/:sessionId/messages', requireAuth, requireMember, getHistory);

// POST /api/chat/:sessionId/messages  (HTTP fallback; sockets are the primary path)
router.post('/:sessionId/messages', requireAuth, requireMember, postMessage);

module.exports = router;
