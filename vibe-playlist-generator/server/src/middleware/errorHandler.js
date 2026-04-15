// Centralised error handler. Routes throw/next(err); this normalises the
// response shape and preserves Spotify's error codes when possible.

module.exports = function errorHandler(err, req, res, _next) {
  // eslint-disable-next-line no-console
  console.error('[vibe:error]', err?.message || err);

  // Axios-style error from a Spotify call
  if (err?.response?.data) {
    const status = err.response.status || 500;
    return res.status(status).json({
      error: 'spotify_error',
      status,
      details: err.response.data,
    });
  }

  const status = err?.status || 500;
  res.status(status).json({
    error: err?.code || 'internal_error',
    message: err?.message || 'Something went wrong.',
  });
};
