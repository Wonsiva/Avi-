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
 * Call Spotify's /recommendations endpoint.
 *
 * Spotify limits seeds to a total of 5 across seed_artists / seed_genres /
 * seed_tracks, so the caller is responsible for keeping the combined count ≤5.
 */
async function getRecommendations(accessToken, params) {
  const clean = Object.fromEntries(
    Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null && v !== ''
    )
  );

  const res = await spotifyRequest({
    method: 'get',
    url: `${API}/recommendations`,
    headers: { Authorization: `Bearer ${accessToken}` },
    params: clean,
  });
  return res.data;
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

/** Audio features for a batch of tracks — gives us BPM/energy for display. */
async function getAudioFeatures(accessToken, ids) {
  if (!ids.length) return [];
  // API caps ids at 100 per request.
  const chunks = [];
  for (let i = 0; i < ids.length; i += 100) {
    chunks.push(ids.slice(i, i + 100));
  }

  const results = [];
  for (const chunk of chunks) {
    const res = await spotifyRequest({
      method: 'get',
      url: `${API}/audio-features`,
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { ids: chunk.join(',') },
    });
    results.push(...(res.data.audio_features || []));
  }
  return results;
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
  getRecommendations,
  searchArtist,
  getTrack,
  getAudioFeatures,
  createPlaylist,
  addTracksToPlaylist,
};
