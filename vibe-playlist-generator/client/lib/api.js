// Tiny backend client. Always uses credentials: 'include' so the session
// cookie gets sent along. Errors are thrown as Error objects with a `.status`
// property so components can distinguish 401 from everything else.

const BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function request(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!res.ok) {
    const err = new Error(data?.message || data?.error || res.statusText);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  base: BASE,

  loginUrl() {
    return `${BASE}/api/auth/login`;
  },

  me: () => request('/api/auth/me'),
  logout: () => request('/api/auth/logout', { method: 'POST' }),

  generate: (body) =>
    request('/api/recommendations/generate', { method: 'POST', body }),

  trackAlike: (body) =>
    request('/api/recommendations/track-alike', { method: 'POST', body }),

  djSet: (body) =>
    request('/api/recommendations/dj-set', { method: 'POST', body }),

  savePlaylist: (body) =>
    request('/api/playlist/save', { method: 'POST', body }),
};
