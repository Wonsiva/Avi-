// Gate endpoints that need a logged-in Spotify user. If the session has a
// refresh token but the access token has expired we transparently refresh it
// before handing the request to the route.

const { refreshAccessToken } = require('../services/spotifyService');

module.exports = async function requireAuth(req, res, next) {
  const tokens = req.session?.spotify;

  if (!tokens?.accessToken) {
    return res.status(401).json({ error: 'not_authenticated' });
  }

  const now = Date.now();
  if (tokens.expiresAt && tokens.expiresAt - now < 60_000) {
    try {
      const refreshed = await refreshAccessToken(tokens.refreshToken);
      req.session.spotify = {
        ...tokens,
        accessToken: refreshed.access_token,
        // Spotify sometimes omits refresh_token on refresh — keep old one.
        refreshToken: refreshed.refresh_token || tokens.refreshToken,
        expiresAt: now + refreshed.expires_in * 1000,
      };
    } catch (err) {
      return next(err);
    }
  }

  req.accessToken = req.session.spotify.accessToken;
  next();
};
