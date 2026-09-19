const express = require('express');
const rateLimit = require('express-rate-limit');
const { signup, login, logout, me } = require('../controllers/authController');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

// Basic brute-force protection on auth endpoints.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

router.post('/signup', authLimiter, signup);
router.post('/login', authLimiter, login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

module.exports = router;
