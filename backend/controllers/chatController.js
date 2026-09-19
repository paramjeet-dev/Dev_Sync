const { getMessagePage, createMessage } = require('../services/chat/chatService');

async function getHistory(req, res, next) {
  try {
    const { sessionId } = req.params;
    const { before, limit } = req.query;
    const result = await getMessagePage({ sessionId, before, limit });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// HTTP fallback for sending a message (primary path is Socket.IO; see sockets/chatHandlers.js).
async function postMessage(req, res, next) {
  try {
    const { sessionId } = req.params;
    const { message } = req.body;
    const doc = await createMessage({
      sessionId,
      userId: req.user.id,
      username: req.user.username,
      message,
    });
    res.status(201).json({ message: doc });
  } catch (err) {
    next(err);
  }
}

module.exports = { getHistory, postMessage };
