// Centralised env + constants. Every other module imports from here so we can
// validate required values once at startup instead of crashing mid-request.

require('dotenv').config();

const required = [
  'SPOTIFY_CLIENT_ID',
  'SPOTIFY_CLIENT_SECRET',
  'SPOTIFY_REDIRECT_URI',
  'SESSION_SECRET',
];

const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  // Soft-warn instead of hard-crash so devs can still boot the server and hit
  // the health endpoint before they've filled in .env.
  // eslint-disable-next-line no-console
  console.warn(
    `[config] Missing env vars: ${missing.join(', ')}. ` +
      'Spotify endpoints will fail until these are set.'
  );
}

module.exports = {
  port: Number(process.env.PORT) || 4000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',

  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID || '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
    redirectUri:
      process.env.SPOTIFY_REDIRECT_URI ||
      'http://localhost:4000/api/auth/callback',

    // Scopes we need:
    //  - user-read-private / user-read-email: profile
    //  - playlist-modify-public / playlist-modify-private: save generated sets
    //  - user-top-read: used by underground bias fallback seeds
    scopes: [
      'user-read-private',
      'user-read-email',
      'playlist-modify-public',
      'playlist-modify-private',
      'user-top-read',
    ].join(' '),

    accountsBase: 'https://accounts.spotify.com',
    apiBase: 'https://api.spotify.com/v1',
  },

  sessionSecret: process.env.SESSION_SECRET || 'dev-only-insecure-secret',
};
