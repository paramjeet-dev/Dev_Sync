// Centralized error handler. Never exposes stack traces or secrets to the client.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;

  if (statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error('[error]', err);
  }

  res.status(statusCode).json({
    error: err.publicMessage || err.message || 'Internal server error.',
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found.' });
}

module.exports = { errorHandler, notFoundHandler };
