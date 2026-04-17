// Recommendation endpoints.
//
// Spotify deprecated /recommendations and /audio-features for apps created
// after 27 Nov 2024, so we generate playlists via the Search API instead.
// The tradeoff: no audio-feature targeting (energy, valence, tempo) — we
// lean on curated seed artists + text queries for vibe accuracy.
//
//  POST /api/recommendations/generate    — vibe form
//  POST /api/recommendations/track-alike — "more like this track"
//  POST /api/recommendations/dj-set      — larger, shuffled pool

const express = require('express');

const requireAuth = require('../middleware/requireAuth');
const {
  searchTracks,
  searchArtist,
  getTrack,
} = require('../services/spotifyService');
const { getPreset } = require('../utils/genrePresets');
const { getLabel } = require('../utils/labelPresets');

const router = express.Router();

// Cache artist name → id to avoid hammering /search on every generate call.
const artistIdCache = new Map();

async function resolveArtistIds(accessToken, names) {
  const out = [];
  for (const name of names) {
    if (artistIdCache.has(name)) {
      out.push({ id: artistIdCache.get(name), name });
      continue;
    }
    try {
      const artist = await searchArtist(accessToken, name);
      if (artist?.id) {
        artistIdCache.set(name, artist.id);
        out.push({ id: artist.id, name: artist.name });
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

  const uri = s.match(/spotify:track:([a-zA-Z0-9]{22})/);
  if (uri) return uri[1];

  const url = s.match(/open\.spotify\.com\/track\/([a-zA-Z0-9]{22})/);
  if (url) return url[1];

  if (/^[a-zA-Z0-9]{22}$/.test(s)) return s;

  return null;
}

/** Fisher-Yates shuffle. */
function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Dedupe tracks by id. */
function dedupeById(tracks) {
  const seen = new Set();
  const out = [];
  for (const t of tracks) {
    if (!t?.id || seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out;
}

/** Normalise a Spotify track object for the frontend. */
function normalizeTrack(t) {
  return {
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
    // Audio features are deprecated for new apps — return nulls so the UI
    // renders "—" rather than breaking.
    features: { energy: null, danceability: null, valence: null, tempo: null },
  };
}

/**
 * Build the vibe-form track pool by:
 *   1. Searching each seed artist's catalogue
 *   2. Running a free-text search with genre + mood keywords
 * Then deduping and shuffling.
 */
async function buildVibePool(accessToken, body) {
  const {
    genre = 'afro-house',
    mood = 'hypnotic',
    artistSeed,
    underground = false,
    label = null,
    limit = 20,
  } = body || {};

  const preset = getPreset(genre);
  const labelPreset = label ? getLabel(label) : null;

  const seedNames = (labelPreset?.artists || preset.seedArtists).slice(0, 4);
  if (artistSeed) seedNames.unshift(artistSeed);

  const resolved = await resolveArtistIds(accessToken, seedNames);
  const seedArtists = resolved.slice(0, 5);

  // Per-artist search: use the artist: filter to pull their top catalogue.
  const pool = [];
  for (const artist of seedArtists) {
    try {
      const tracks = await searchTracks(
        accessToken,
        `artist:"${artist.name}"`,
        { limit: 20 }
      );
      pool.push(...tracks);
    } catch (_err) {
      // Skip artists that fail search.
    }
  }

  // Text search on the genre label to widen the pool with tracks we might
  // otherwise miss. Also fold mood in as a loose keyword match.
  try {
    const textQ = [preset.label, mood].filter(Boolean).join(' ');
    const textHits = await searchTracks(accessToken, textQ, { limit: 30 });
    pool.push(...textHits);
  } catch (_err) {
    /* ignore */
  }

  let deduped = dedupeById(pool);

  // Underground bias — filter out higher-popularity tracks.
  if (underground) {
    deduped = deduped.filter((t) => (t.popularity ?? 100) <= 45);
  }

  const shuffled = shuffle(deduped);
  const sliced = shuffled.slice(0, Math.max(1, Math.min(100, Number(limit) || 20)));

  return {
    tracks: sliced.map(normalizeTrack),
    meta: {
      genre: preset.label,
      mood,
      energy: body?.energy ?? null,
      underground,
      label: labelPreset?.label || null,
      bpm: { min: preset.bpm.min, max: preset.bpm.max },
      engine: 'search',
    },
  };
}

router.post('/generate', requireAuth, async (req, res, next) => {
  try {
    const result = await buildVibePool(req.accessToken, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/track-alike', requireAuth, async (req, res, next) => {
  try {
    const trackId = parseTrackId(req.body?.trackUrl);
    if (!trackId) {
      return res.status(400).json({
        error: 'invalid_track',
        message: 'Could not parse a Spotify track ID from that input.',
      });
    }

    const source = await getTrack(req.accessToken, trackId);
    const primaryArtist = source.artists?.[0]?.name;

    const limit = Math.max(1, Math.min(50, Number(req.body?.limit) || 20));

    // Pull the artist's other tracks + a text search on the track name's words
    // to find similar-sounding songs.
    const pool = [];

    if (primaryArtist) {
      try {
        const byArtist = await searchTracks(
          req.accessToken,
          `artist:"${primaryArtist}"`,
          { limit: 30 }
        );
        pool.push(...byArtist);
      } catch (_err) {}
    }

    try {
      // Strip punctuation, use the first couple of meaningful words as a query.
      const keywords = (source.name || '')
        .replace(/\(.+?\)|\[.+?\]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2)
        .slice(0, 3)
        .join(' ');
      if (keywords) {
        const text = await searchTracks(req.accessToken, keywords, { limit: 20 });
        pool.push(...text);
      }
    } catch (_err) {}

    let deduped = dedupeById(pool).filter((t) => t.id !== trackId);

    if (req.body?.underground) {
      deduped = deduped.filter((t) => (t.popularity ?? 100) <= 45);
    }

    const tracks = shuffle(deduped).slice(0, limit).map(normalizeTrack);

    res.json({
      meta: {
        source: {
          name: source.name,
          artist: primaryArtist || null,
          image: source.album?.images?.[0]?.url || null,
          url: source.external_urls?.spotify || null,
        },
        engine: 'search',
      },
      tracks,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/dj-set', requireAuth, async (req, res, next) => {
  try {
    const length = Math.max(8, Math.min(60, Number(req.body?.length) || 30));

    // Build a bigger pool, then take the requested length. Without audio
    // features we can't order by BPM/energy ramp any more — the pool is
    // shuffled so consecutive tracks are varied.
    const result = await buildVibePool(req.accessToken, {
      ...req.body,
      limit: Math.min(100, length * 2),
    });

    res.json({
      meta: { ...result.meta, djSet: true, length: Math.min(length, result.tracks.length) },
      tracks: result.tracks.slice(0, length),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
