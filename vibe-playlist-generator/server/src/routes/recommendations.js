// Recommendation endpoints — powered by Spotify's Search API.
//
// Spotify deprecated /recommendations and /audio-features for apps created
// after 27 Nov 2024. We use Search + artist catalogues instead.

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
    } catch (err) {
      console.log(`[vibe] artist resolve failed for "${name}":`, err.message);
    }
  }
  return out;
}

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

function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function dedupeById(tracks) {
  const seen = new Set();
  return tracks.filter((t) => {
    if (!t?.id || seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

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
    features: { energy: null, danceability: null, valence: null, tempo: null },
  };
}

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

  const seedNames = [...(labelPreset?.artists || preset.seedArtists).slice(0, 4)];
  if (artistSeed) seedNames.unshift(artistSeed);

  console.log(`[vibe] generating: genre=${genre} mood=${mood} seeds=${seedNames.join(', ')}`);

  const resolved = await resolveArtistIds(accessToken, seedNames);
  console.log(`[vibe] resolved ${resolved.length} artists: ${resolved.map(a => a.name).join(', ')}`);

  const pool = [];

  // Search by each artist name (simpler query — no field filter)
  for (const artist of resolved.slice(0, 5)) {
    try {
      const tracks = await searchTracks(accessToken, artist.name, { limit: 15 });
      console.log(`[vibe]   "${artist.name}" → ${tracks.length} tracks`);
      pool.push(...tracks);
    } catch (err) {
      console.log(`[vibe]   "${artist.name}" search failed:`, err.message);
    }
  }

  // Broader genre/mood text search
  const textQuery = `${preset.label} ${mood}`;
  try {
    const textHits = await searchTracks(accessToken, textQuery, { limit: 30 });
    console.log(`[vibe]   text search "${textQuery}" → ${textHits.length} tracks`);
    pool.push(...textHits);
  } catch (err) {
    console.log(`[vibe]   text search failed:`, err.message);
  }

  let deduped = dedupeById(pool);
  console.log(`[vibe] total pool: ${pool.length}, after dedupe: ${deduped.length}`);

  if (underground) {
    deduped = deduped.filter((t) => (t.popularity ?? 100) <= 45);
    console.log(`[vibe] after underground filter: ${deduped.length}`);
  }

  const shuffled = shuffle(deduped);
  const sliced = shuffled.slice(0, Math.max(1, Math.min(100, Number(limit) || 20)));

  console.log(`[vibe] returning ${sliced.length} tracks`);

  return {
    tracks: sliced.map(normalizeTrack),
    meta: {
      genre: preset.label,
      mood,
      energy: body?.energy ?? null,
      underground,
      label: labelPreset?.label || null,
      bpm: { min: preset.bpm.min, max: preset.bpm.max },
      trackCount: sliced.length,
    },
  };
}

// Diagnostic endpoint — hit this in your browser to test if search works.
// GET /api/recommendations/test
router.get('/test', requireAuth, async (req, res, next) => {
  try {
    console.log('[vibe] /test endpoint hit — searching for "Keinemusik"...');
    const tracks = await searchTracks(req.accessToken, 'Keinemusik', { limit: 5 });
    console.log(`[vibe] /test got ${tracks.length} tracks`);
    res.json({
      ok: true,
      message: `Search returned ${tracks.length} tracks`,
      tracks: tracks.map((t) => ({
        name: t.name,
        artist: t.artists?.[0]?.name,
        id: t.id,
      })),
    });
  } catch (err) {
    console.log('[vibe] /test error:', err.message);
    res.status(500).json({
      ok: false,
      error: err.message,
      details: err.response?.data || null,
    });
  }
});

router.post('/generate', requireAuth, async (req, res, next) => {
  try {
    console.log('[vibe] POST /generate received');
    const result = await buildVibePool(req.accessToken, req.body);
    res.json(result);
  } catch (err) {
    console.log('[vibe] /generate error:', err.message);
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

    const pool = [];
    if (primaryArtist) {
      try {
        const byArtist = await searchTracks(req.accessToken, primaryArtist, { limit: 30 });
        pool.push(...byArtist);
      } catch (_err) {}
    }

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
