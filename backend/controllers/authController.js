const User = require('../models/User');
const { registerUser, loginUser, AuthError } = require('../services/auth/authService');
const config = require('../config/env');

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: config.nodeEnv === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

async function signup(req, res, next) {
  try {
    const { username, email, password } = req.body;
    const { user, token } = await registerUser({ username, email, password });
    res.cookie(config.cookieName, token, COOKIE_OPTIONS);
    res.status(201).json({ user: user.toPublicJSON(), token });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { identifier, password } = req.body;
    const { user, token } = await loginUser({ identifier, password });
    res.cookie(config.cookieName, token, COOKIE_OPTIONS);
    res.status(200).json({ user: user.toPublicJSON(), token });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
}

function logout(req, res) {
  res.clearCookie(config.cookieName);
  res.status(200).json({ message: 'Logged out.' });
}

async function me(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.status(200).json({ user: user.toPublicJSON() });
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, login, logout, me };
