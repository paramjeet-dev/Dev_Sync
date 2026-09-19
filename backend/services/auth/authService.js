const User = require('../../models/User');
const { signToken } = require('./tokenService');

const AVATAR_COLORS = [
  '#F87171', '#FB923C', '#FBBF24', '#A3E635',
  '#34D399', '#22D3EE', '#60A5FA', '#A78BFA',
  '#F472B6', '#FB7185',
];

function randomAvatarColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

class AuthError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

async function registerUser({ username, email, password }) {
  if (!username || !email || !password) {
    throw new AuthError('username, email, and password are required.');
  }
  if (password.length < 8) {
    throw new AuthError('Password must be at least 8 characters.');
  }

  const existing = await User.findOne({
    $or: [{ email: email.toLowerCase() }, { username }],
  });
  if (existing) {
    throw new AuthError('A user with that username or email already exists.', 409);
  }

  const passwordHash = await User.hashPassword(password);
  const user = await User.create({
    username,
    email,
    passwordHash,
    avatarColor: randomAvatarColor(),
  });

  const token = signToken(user);
  return { user, token };
}

async function loginUser({ identifier, password }) {
  if (!identifier || !password) {
    throw new AuthError('username/email and password are required.');
  }

  const user = await User.findOne({
    $or: [{ email: identifier.toLowerCase() }, { username: identifier }],
  });
  if (!user) {
    throw new AuthError('Invalid credentials.', 401);
  }

  const valid = await user.comparePassword(password);
  if (!valid) {
    throw new AuthError('Invalid credentials.', 401);
  }

  const token = signToken(user);
  return { user, token };
}

module.exports = { registerUser, loginUser, AuthError };
