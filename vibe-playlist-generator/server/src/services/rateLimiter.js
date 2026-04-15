// Thin wrapper around axios that respects Spotify's rate limits.
//
// Spotify's `/recommendations` and friends return:
//   - 429 with a Retry-After header when you've exceeded the burst budget
//   - 5xx when something transient is going on
//
// We also keep a tiny in-process queue so concurrent callers don't stampede
// the same endpoint during a burst. This is not a distributed limiter — if you
// run multiple server instances put a real limiter (redis + token bucket) in
// front of it.

const axios = require('axios');

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;

// Simple in-process sequencer: one request at a time per host to avoid
// blowing past burst limits when many clients hit /generate at once.
const hostQueues = new Map();

function enqueue(host, task) {
  const prev = hostQueues.get(host) || Promise.resolve();
  const next = prev.then(task, task);
  // Don't keep failed chains alive forever.
  hostQueues.set(
    host,
    next.catch(() => {})
  );
  return next;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * spotifyRequest — drop-in replacement for axios() that:
 *   - serialises outbound calls per-host (burst protection)
 *   - handles 429 with Retry-After
 *   - retries 5xx with exponential backoff
 *
 * @param {import('axios').AxiosRequestConfig} config
 */
async function spotifyRequest(config) {
  const url = new URL(config.url);
  const host = url.host;

  return enqueue(host, async () => {
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        return await axios(config);
      } catch (err) {
        const status = err?.response?.status;

        if (status === 429 && attempt < MAX_RETRIES) {
          const retryAfter =
            Number(err.response.headers['retry-after'] || 1) * 1000;
          await sleep(retryAfter);
          attempt += 1;
          continue;
        }

        if (status >= 500 && status < 600 && attempt < MAX_RETRIES) {
          await sleep(BASE_BACKOFF_MS * 2 ** attempt);
          attempt += 1;
          continue;
        }

        throw err;
      }
    }
  });
}

module.exports = { spotifyRequest };
