const GENERIC_5XX = 'Something went wrong on our end. Please try again.';

// Centralized error handler. Never exposes stack traces, provider messages or secrets.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.publicMessage;

  if (err.name === 'MulterError') {
    statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'That file is too large.' : 'Invalid file upload.';
  } else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Malformed request body.';
  }

  if (statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error('[error]', err); // full detail stays in server logs only
    return res.status(statusCode).json({ error: message || GENERIC_5XX });
  }
  return res.status(statusCode).json({ error: message || err.message || 'Bad request.' });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found.' });
}

module.exports = { errorHandler, notFoundHandler };
