const ChatMessage = require('../../models/ChatMessage');

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

/**
 * Persist a new chat message. This is the single write path used by both
 * the HTTP route (fallback/testing) and the Socket.IO chat handler, so the
 * database is always the source of truth before anything is broadcast.
 */
async function createMessage({ sessionId, userId, username, message, metadata = {} }) {
  const trimmed = (message || '').trim();
  if (!trimmed) {
    const err = new Error('Message cannot be empty.');
    err.statusCode = 400;
    throw err;
  }
  if (trimmed.length > 2000) {
    const err = new Error('Message is too long (max 2000 characters).');
    err.statusCode = 400;
    throw err;
  }
  if (!sessionId) {
    const err = new Error('sessionId is required.');
    err.statusCode = 400;
    throw err;
  }

  const doc = await ChatMessage.create({
    sessionId,
    userId,
    username,
    message: trimmed,
    metadata,
  });

  return doc.toPublicJSON();
}

/**
 * Cursor-based pagination using createdAt + _id as the cursor, sorted newest-first.
 * `before` is an ISO timestamp (or message id) marking the oldest message the
 * client has already seen; omit it to fetch the most recent page.
 */
async function getMessagePage({ sessionId, before, limit }) {
  if (!sessionId) {
    const err = new Error('sessionId is required.');
    err.statusCode = 400;
    throw err;
  }

  const pageSize = Math.min(parseInt(limit, 10) || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

  const query = { sessionId };
  if (before) {
    const beforeDate = new Date(before);
    if (!Number.isNaN(beforeDate.getTime())) {
      query.createdAt = { $lt: beforeDate };
    }
  }

  // Fetch pageSize + 1 to know if there's another older page available.
  const docs = await ChatMessage.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(pageSize + 1)
    .lean();

  const hasMore = docs.length > pageSize;
  const page = docs.slice(0, pageSize).map((doc) => ({
    id: doc._id.toString(),
    sessionId: doc.sessionId,
    userId: doc.userId.toString(),
    username: doc.username,
    message: doc.message,
    metadata: doc.metadata,
    createdAt: doc.createdAt,
  }));

  // Return in chronological (oldest-first) order for easy rendering/prepending.
  const chronological = page.reverse();

  return {
    messages: chronological,
    pagination: {
      hasMore,
      nextCursor: hasMore ? page[page.length - 1].createdAt : null,
      pageSize,
    },
  };
}

module.exports = { createMessage, getMessagePage, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE };
