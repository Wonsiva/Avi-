// DJ Set Mode — takes a raw track list (with audio features attached) and
// orders it into a playable flow.
//
// Heuristic:
//   1. Pick a starting track near the lower end of the energy range.
//   2. Sort the rest by energy ascending, but greedily prefer the next track
//      whose tempo is closest to the current one (smooth BPM transitions).
//   3. After the peak, let energy ramp down gently for the last ~20%.
//
// This isn't harmonic mixing — Spotify doesn't expose key confidence well
// enough to key-match reliably — but an energy+BPM ramp already feels
// dramatically more "set-like" than a shuffled recommendations response.

function byEnergyAsc(a, b) {
  return (a.features.energy || 0) - (b.features.energy || 0);
}

function tempoDistance(a, b) {
  // Also consider half/double tempo as "close enough" for drum-heavy tracks.
  const ta = a.features.tempo || 0;
  const tb = b.features.tempo || 0;
  const direct = Math.abs(ta - tb);
  const halved = Math.abs(ta - tb / 2);
  const doubled = Math.abs(ta - tb * 2);
  return Math.min(direct, halved, doubled);
}

/**
 * @param {Array<{track: object, features: object}>} enriched
 * @returns {Array} ordered list in the same shape
 */
function buildDjSetOrder(enriched) {
  if (enriched.length <= 2) return enriched;

  const valid = enriched.filter(
    (t) => t.features && typeof t.features.energy === 'number'
  );
  if (!valid.length) return enriched;

  const sorted = [...valid].sort(byEnergyAsc);

  const rampUpCount = Math.floor(sorted.length * 0.8);
  const rampUp = sorted.slice(0, rampUpCount);
  const rampDown = sorted.slice(rampUpCount).reverse(); // descend energy

  // Greedy BPM smoothing within the ramp-up section. Start with the lowest-
  // energy track; at each step pick the remaining track whose tempo is closest
  // to the current one.
  const result = [];
  const pool = [...rampUp];
  let current = pool.shift();
  if (current) result.push(current);

  while (pool.length) {
    pool.sort((a, b) => tempoDistance(current, a) - tempoDistance(current, b));
    // But don't ignore energy entirely — keep the next pick within the top
    // third of the remaining pool by energy so we still climb.
    const energyCutoff =
      pool[Math.floor(pool.length / 3)]?.features?.energy ?? Infinity;
    const next =
      pool.find((t) => (t.features.energy || 0) <= energyCutoff) || pool[0];
    pool.splice(pool.indexOf(next), 1);
    result.push(next);
    current = next;
  }

  return [...result, ...rampDown];
}

module.exports = { buildDjSetOrder };
