// Mood → audio-feature mapping. These values were tuned by ear on a bunch of
// reference sets; they're not scientific but they produce noticeably better
// results than leaving the features at defaults.
//
// Spotify audio features cheat sheet:
//   energy         0..1  — intensity, loudness, noise
//   danceability   0..1  — how rhythmically suited to dancing
//   valence        0..1  — musical positivity (0 sad/dark, 1 happy)
//   instrumentalness 0..1 — 1 means likely no vocals
//   acousticness   0..1  — 1 means likely acoustic
//   mode           0|1   — minor (0) / major (1)
//   tempo          BPM

const MOODS = {
  hypnotic: {
    target_valence: 0.35,
    target_instrumentalness: 0.55,
    target_danceability: 0.78,
    target_acousticness: 0.1,
  },
  emotional: {
    target_valence: 0.45,
    target_instrumentalness: 0.3,
    target_danceability: 0.7,
    target_acousticness: 0.2,
    target_mode: 1,
  },
  dark: {
    target_valence: 0.2,
    target_mode: 0,
    target_instrumentalness: 0.55,
    target_danceability: 0.72,
  },
  uplifting: {
    target_valence: 0.75,
    target_mode: 1,
    target_danceability: 0.78,
    target_acousticness: 0.15,
  },
  dreamy: {
    target_valence: 0.5,
    target_acousticness: 0.35,
    target_instrumentalness: 0.5,
    target_danceability: 0.65,
  },
  driving: {
    target_valence: 0.45,
    target_energy: 0.78,
    target_danceability: 0.8,
    target_instrumentalness: 0.5,
  },
  warm: {
    target_valence: 0.6,
    target_acousticness: 0.3,
    target_danceability: 0.72,
    target_instrumentalness: 0.4,
  },
};

/**
 * Map the 1..10 energy slider onto target_energy and target_danceability.
 * Danceability ramps less aggressively than energy so low settings still
 * produce grooves you can actually move to.
 */
function energyToFeatures(level) {
  const clamped = Math.max(1, Math.min(10, Number(level) || 5));
  // Linear-ish with a gentle floor/ceiling.
  const energy = 0.35 + (clamped - 1) * 0.065; // 0.35 .. 0.935
  const dance = 0.55 + (clamped - 1) * 0.04; // 0.55 .. 0.91
  return {
    target_energy: Number(energy.toFixed(2)),
    target_danceability: Number(dance.toFixed(2)),
  };
}

/**
 * Combine mood + energy + BPM inputs into Spotify audio-feature params.
 * Later overrides win — mood first, then energy slider, then explicit BPM.
 */
function buildAudioFeatures({ mood, energy, bpmMin, bpmMax, targetTempo }) {
  const base = MOODS[mood] || MOODS.hypnotic;
  const energyFeatures = energyToFeatures(energy);

  const features = { ...base, ...energyFeatures };

  if (bpmMin) features.min_tempo = Number(bpmMin);
  if (bpmMax) features.max_tempo = Number(bpmMax);
  if (targetTempo) features.target_tempo = Number(targetTempo);

  return features;
}

module.exports = {
  MOODS,
  buildAudioFeatures,
  energyToFeatures,
};
