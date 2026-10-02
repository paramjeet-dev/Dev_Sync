const { isMember } = require('../services/sessionService');

// Must run after requireAuth. Responds 404 (not 403) so the API doesn't confirm that a board
// exists to someone who hasn't joined it.
async function requireMember(req, res, next) {
  try {
    if (!(await isMember(req.params.sessionId, req.user.id))) {
      return res.status(404).json({ error: 'Session not found.' });
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireMember };
