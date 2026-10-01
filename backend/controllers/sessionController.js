const {
  createSession,
  getSessionBySessionId,
  getSnapshot,
  listSessionsForUser,
  deleteSessionForUser,
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

async function list(req, res, next) {
  try {
    res.status(200).json({ sessions: await listSessionsForUser(req.user.id) });
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

// Creator: deletes the board + its chat for everyone.
// Anyone else: just removes it from their own list.
async function remove(req, res, next) {
  try {
    const { sessionId } = req.params;
    const { result } = await deleteSessionForUser(sessionId, req.user.id);
    if (result === 'not_found') {
      return res.status(404).json({ error: 'Session not found.' });
    }
    if (result === 'deleted') {
      // Tell anyone currently inside the board to leave.
      req.app.get('io')?.to(sessionId).emit('session:deleted', { sessionId });
    }
    res.status(200).json({ result });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getOne, getSnapshotHandler, remove };
