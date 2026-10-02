/**
 * One place that turns any failed request into a message that is safe and useful to show a person.
 * Prefers the server's own (already sanitized) message; never surfaces axios internals such as
 * "Request failed with status code 401".
 */
export function getErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  const serverMessage = err?.response?.data?.error;
  if (typeof serverMessage === 'string' && serverMessage) return serverMessage;
  if (!err?.response) return "Can't reach the server. Check your connection and try again.";
  if (err.response.status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (err.response.status >= 500) return 'The server had a problem. Please try again in a moment.';
  return fallback;
}
