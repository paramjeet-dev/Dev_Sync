const {
  createSession,
  getSessionBySessionId,
  getSnapshot,
} = require('../services/sessionService');

async function create(req, res, next) {
  try {
    const { name } = req.body;
    const session = await createSession({ name, createdBy: req.user.id });
    res.status(201).json({ session });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const { sessionId } = req.params;
    const session = await getSessionBySessionId(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }
    res.status(200).json({ session: session.toPublicJSON() });
  } catch (err) {
    next(err);
  }
}

async function getSnapshotHandler(req, res, next) {
  try {
    const { sessionId } = req.params;
    const snapshot = await getSnapshot(sessionId);
    res.status(200).json({ snapshot });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, getOne, getSnapshotHandler };
