// Recommendation endpoints.
//
//  POST /api/recommendations/generate
//       Main vibe-form generator. Body:
//         {
//           genre: 'afro-house',
//           mood: 'hypnotic',
//           energy: 7,
//           bpmMin, bpmMax,
//           artistSeed: 'Keinemusik' | null,
//           underground: boolean,
//           label: 'moblack' | 'keinemusik' | 'dawn-patrol' | null,
//           limit: 20
//         }
//
//  POST /api/recommendations/track-alike
//       { trackUrl: 'https://open.spotify.com/track/...' }
//       Generates tracks similar to one the user pastes in.
//
//  POST /api/recommendations/dj-set
//       Same body as /generate plus { length: 30 }. Returns tracks ordered as
//       a smooth-flow DJ set instead of raw recommendation order.

const express = require('express');

const requireAuth = require('../middleware/requireAuth');
const {
  getRecommendations,
  searchArtist,
  getTrack,
  getAudioFeatures,
} = require('../services/spotifyService');
const { buildAudioFeatures } = require('../utils/vibeMap');
const { getPreset } = require('../utils/genrePresets');
const { getLabel } = require('../utils/labelPresets');
const { buildDjSetOrder } = require('../utils/djSet');

const router = express.Router();

// In-memory cache of artist name → id so we don't hammer /search on every
// generate call. Keyed per server process; small enough to leak safely.
const artistIdCache = new Map();

async function resolveArtistIds(accessToken, names) {
  const out = [];
  for (const name of names) {
    if (artistIdCache.has(name)) {
      out.push(artistIdCache.get(name));
      continue;
    }
    try {
      const artist = await searchArtist(accessToken, name);
      if (artist?.id) {
        artistIdCache.set(name, artist.id);
        out.push(artist.id);
      }
    } catch (_err) {
      // A single bad seed shouldn't kill the whole request.
    }
  }
  return out;
}

/** Extract the track ID from a Spotify URL, URI, or bare ID. */
function parseTrackId(input) {
  if (!input) return null;
  const s = String(input).trim();

  // spotify:track:ID
  const uri = s.match(/spotify:track:([a-zA-Z0-9]{22})/);
  if (uri) return uri[1];

  // https://open.spotify.com/track/ID?si=...
  const url = s.match(/open\.spotify\.com\/track\/([a-zA-Z0-9]{22})/);
  if (url) return url[1];

  // bare 22-char id
  if (/^[a-zA-Z0-9]{22}$/.test(s)) return s;

  return null;
}

/**
 * Build the parameter bag for /recommendations from a vibe-form body.
 * Returns { params, meta } where meta is echoed back to the client for display.
 */
async function buildRecommendationParams(accessToken, body) {
  const {
    genre = 'afro-house',
    mood = 'hypnotic',
    energy = 6,
    bpmMin,
    bpmMax,
    artistSeed,
    underground = false,
    label = null,
    limit = 20,
  } = body || {};

  const preset = getPreset(genre);
  const labelPreset = label ? getLabel(label) : null;

  // Audio features from mood / energy / BPM
  const audioFeatures = buildAudioFeatures({
    mood,
    energy,
    bpmMin,
    bpmMax,
    targetTempo: preset.bpm.target,
  });

  // Seed budget: Spotify allows up to 5 total across artists/genres/tracks.
  // Prefer artist seeds (they drive vibe accuracy way more than genre tags)
  // but leave room for a user-supplied artist or track.

  const baseArtistNames = (labelPreset?.artists || preset.seedArtists).slice(
    0,
    3
  );
  let seedArtists = await resolveArtistIds(accessToken, baseArtistNames);

  if (artistSeed) {
    const extra = await resolveArtistIds(accessToken, [artistSeed]);
    seedArtists = [...extra, ...seedArtists].slice(0, 4);
  } else {
    seedArtists = seedArtists.slice(0, 4);
  }

  const params = {
    limit: Math.max(1, Math.min(100, Number(limit) || 20)),
    seed_artists: seedArtists.join(',') || undefined,
    ...audioFeatures,
  };

  // Fill any remaining seed slots with a real Spotify genre token if we have
  // fewer than 5 seeds — this widens the pool without drifting off-vibe.
  const seedsUsed = (params.seed_artists ? seedArtists.length : 0);
  if (seedsUsed < 5 && preset.fallbackGenres?.length) {
    const room = Math.max(0, 5 - seedsUsed);
    params.seed_genres = preset.fallbackGenres.slice(0, room).join(',');
  }

  if (underground) {
    params.max_popularity = 45;
  }

  // Respect user-supplied BPM range, otherwise use the preset's band.
  if (!params.min_tempo) params.min_tempo = preset.bpm.min;
  if (!params.max_tempo) params.max_tempo = preset.bpm.max;

  return {
    params,
    meta: {
      genre: preset.label,
      mood,
      energy,
      underground,
      label: labelPreset?.label || null,
      bpm: { min: params.min_tempo, max: params.max_tempo },
    },
  };
}

/**
 * Enrich the raw recommendation response with audio features so the frontend
 * can show BPM/energy per track.
 */
async function enrichTracks(accessToken, tracks) {
  const ids = tracks.map((t) => t.id).filter(Boolean);
  const features = await getAudioFeatures(accessToken, ids);
  const byId = new Map(features.filter(Boolean).map((f) => [f.id, f]));

  return tracks.map((t) => ({
    track: {
      id: t.id,
      uri: t.uri,
      name: t.name,
      url: t.external_urls?.spotify || null,
      preview: t.preview_url || null,
      popularity: t.popularity,
      artists: (t.artists || []).map((a) => ({ id: a.id, name: a.name })),
      album: {
        name: t.album?.name,
        image: t.album?.images?.[0]?.url || null,
      },
    },
    features: {
      energy: byId.get(t.id)?.energy ?? null,
      danceability: byId.get(t.id)?.danceability ?? null,
      valence: byId.get(t.id)?.valence ?? null,
      tempo: byId.get(t.id)?.tempo ?? null,
    },
  }));
}

router.post('/generate', requireAuth, async (req, res, next) => {
  try {
    const { params, meta } = await buildRecommendationParams(
      req.accessToken,
      req.body
    );

    const data = await getRecommendations(req.accessToken, params);
    const enriched = await enrichTracks(req.accessToken, data.tracks);

    res.json({ meta, params, tracks: enriched });
  } catch (err) {
    next(err);
  }
});

router.post('/track-alike', requireAuth, async (req, res, next) => {
  try {
    const trackId = parseTrackId(req.body?.trackUrl);
    if (!trackId) {
      return res
        .status(400)
        .json({ error: 'invalid_track', message: 'Could not parse a Spotify track ID from that input.' });
    }

    const source = await getTrack(req.accessToken, trackId);
    const [features] = await getAudioFeatures(req.accessToken, [trackId]);

    const params = {
      limit: Math.max(1, Math.min(100, Number(req.body?.limit) || 20)),
      seed_tracks: trackId,
      seed_artists:
        source.artists?.slice(0, 2).map((a) => a.id).join(',') || undefined,
      target_energy: features?.energy,
      target_danceability: features?.danceability,
      target_valence: features?.valence,
      target_tempo: features?.tempo,
      min_tempo: features?.tempo ? features.tempo - 4 : undefined,
      max_tempo: features?.tempo ? features.tempo + 4 : undefined,
    };

    if (req.body?.underground) {
      params.max_popularity = 45;
    }

    const data = await getRecommendations(req.accessToken, params);
    const enriched = await enrichTracks(req.accessToken, data.tracks);

    res.json({
      meta: {
        source: {
          name: source.name,
          artist: source.artists?.[0]?.name,
          image: source.album?.images?.[0]?.url,
          url: source.external_urls?.spotify,
          tempo: features?.tempo,
          energy: features?.energy,
        },
      },
      params,
      tracks: enriched,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/dj-set', requireAuth, async (req, res, next) => {
  try {
    const length = Math.max(8, Math.min(60, Number(req.body?.length) || 30));

    // Pull a bigger pool than `length` so the ordering pass has material to
    // work with after filtering.
    const { params, meta } = await buildRecommendationParams(req.accessToken, {
      ...req.body,
      limit: Math.min(100, length * 2),
    });

    const data = await getRecommendations(req.accessToken, params);
    const enriched = await enrichTracks(req.accessToken, data.tracks);

    const ordered = buildDjSetOrder(enriched).slice(0, length);

    res.json({
      meta: { ...meta, djSet: true, length: ordered.length },
      params,
      tracks: ordered,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
