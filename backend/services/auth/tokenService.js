const jwt = require('jsonwebtoken');
const config = require('../../config/env');

function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), username: user.username },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

module.exports = { signToken, verifyToken };
