const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  create,
  join,
  list,
  getOne,
  getSnapshotHandler,
  remove,
  rename,
  saveThumbnailHandler,
} = require('../controllers/sessionController');
const { requireAuth } = require('../middleware/requireAuth');
const { requireMember } = require('../middleware/requireMember');

const router = express.Router();

// The room code acts like a password, so make guessing it impractical. Only failed attempts
// count (successful joins/re-opens are free), keyed per user rather than per IP.
const joinLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `user:${req.user.id}`,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

router.get('/', requireAuth, list);
router.post('/', requireAuth, create);
router.post('/:sessionId/join', requireAuth, joinLimiter, join);

router.get('/:sessionId', requireAuth, requireMember, getOne);
router.get('/:sessionId/snapshot', requireAuth, requireMember, getSnapshotHandler);
router.patch('/:sessionId', requireAuth, rename);
router.put('/:sessionId/thumbnail', requireAuth, saveThumbnailHandler);
router.delete('/:sessionId', requireAuth, remove);

module.exports = router;
