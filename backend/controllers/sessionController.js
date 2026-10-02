const {
  createSession,
  joinSession,
  getSessionBySessionId,
  getSnapshot,
  listSessionsForUser,
  deleteSessionForUser,
  renameSession,
  setThumbnail,
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

// Joining with the room code is what grants membership (and therefore access to chat and scene).
async function join(req, res, next) {
  try {
    const session = await joinSession(req.params.sessionId, req.user.id);
    if (!session) return res.status(404).json({ error: 'Board not found. Check the room code.' });
    res.status(200).json({ session });
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

const THUMBNAIL_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_THUMBNAIL_CHARS = 80000; // ~60KB decoded

async function rename(req, res, next) {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name || name.length > 60) {
      return res.status(400).json({ error: 'Board name must be 1-60 characters.' });
    }
    const { result } = await renameSession(req.params.sessionId, req.user.id, name);
    if (result === 'not_found') return res.status(404).json({ error: 'Session not found.' });
    if (result === 'forbidden') return res.status(403).json({ error: 'Only the creator can rename this board.' });
    res.status(200).json({ session: { sessionId: req.params.sessionId, name } });
  } catch (err) {
    next(err);
  }
}

async function saveThumbnailHandler(req, res, next) {
  try {
    const thumbnail = req.body?.thumbnail;
    if (typeof thumbnail !== 'string' || thumbnail.length > MAX_THUMBNAIL_CHARS || !THUMBNAIL_RE.test(thumbnail)) {
      return res.status(400).json({ error: 'Invalid thumbnail.' });
    }
    const ok = await setThumbnail(req.params.sessionId, req.user.id, thumbnail);
    if (!ok) return res.status(404).json({ error: 'Session not found.' });
    res.status(200).json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, join, list, getOne, getSnapshotHandler, remove, rename, saveThumbnailHandler };
