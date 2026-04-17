// All Spotify Web API calls live here. Routes should never touch axios
// directly — this file gives us one place to add logging, caching, or swap
// transports later.

const qs = require('querystring');
const config = require('../config');
const { spotifyRequest } = require('./rateLimiter');

const ACCOUNTS = config.spotify.accountsBase;
const API = config.spotify.apiBase;

function basicAuthHeader() {
  const token = Buffer.from(
    `${config.spotify.clientId}:${config.spotify.clientSecret}`
  ).toString('base64');
  return `Basic ${token}`;
}

/** Exchange an auth code for access + refresh tokens. */
async function exchangeCodeForTokens(code) {
  const res = await spotifyRequest({
    method: 'post',
    url: `${ACCOUNTS}/api/token`,
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    data: qs.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.spotify.redirectUri,
    }),
  });
  return res.data;
}

/** Use a refresh token to get a fresh access token. */
async function refreshAccessToken(refreshToken) {
  const res = await spotifyRequest({
    method: 'post',
    url: `${ACCOUNTS}/api/token`,
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    data: qs.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  return res.data;
}

/** /me — current user profile */
async function getMe(accessToken) {
  const res = await spotifyRequest({
    method: 'get',
    url: `${API}/me`,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

/**
 * Search tracks with an arbitrary Spotify query string.
 *
 * Spotify's /recommendations and /audio-features endpoints were deprecated for
 * new apps in Nov 2024, so the Search API is how we build playlists now. It
 * supports field filters like `artist:"Name"`, `year:2022-2024`, `genre:"house"`.
 */
async function searchTracks(accessToken, query, { limit = 20, offset = 0 } = {}) {
  const res = await spotifyRequest({
    method: 'get',
    url: `${API}/search`,
    headers: { Authorization: `Bearer ${accessToken}` },
    params: {
      q: query,
      type: 'track',
      limit: Math.min(50, Math.max(1, limit)),
      offset,
    },
  });
  return res.data.tracks?.items || [];
}

/** Search for an artist by name — used by Label Mode to resolve artist IDs. */
async function searchArtist(accessToken, name) {
  const res = await spotifyRequest({
    method: 'get',
    url: `${API}/search`,
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { q: name, type: 'artist', limit: 1 },
  });
  return res.data.artists.items[0] || null;
}

/** Fetch a single track (used by Track-Alike). */
async function getTrack(accessToken, trackId) {
  const res = await spotifyRequest({
    method: 'get',
    url: `${API}/tracks/${trackId}`,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

/** Create a new playlist on the user's account. */
async function createPlaylist(accessToken, userId, { name, description, isPublic }) {
  const res = await spotifyRequest({
    method: 'post',
    url: `${API}/users/${userId}/playlists`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    data: {
      name,
      description,
      public: !!isPublic,
    },
  });
  return res.data;
}

/** Add tracks (in chunks of 100) to a playlist. */
async function addTracksToPlaylist(accessToken, playlistId, uris) {
  const chunks = [];
  for (let i = 0; i < uris.length; i += 100) {
    chunks.push(uris.slice(i, i + 100));
  }
  for (const chunk of chunks) {
    await spotifyRequest({
      method: 'post',
      url: `${API}/playlists/${playlistId}/tracks`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      data: { uris: chunk },
    });
  }
}

module.exports = {
  exchangeCodeForTokens,
  refreshAccessToken,
  getMe,
  searchTracks,
  searchArtist,
  getTrack,
  createPlaylist,
  addTracksToPlaylist,
};
