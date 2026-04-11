# Vibe Playlist Generator

A production-ready web app that generates highly curated Spotify playlists tuned
for electronic music vibes — **Afro House, Melodic Tech, Deep House, Organic
House**. Built for DJs and listeners who want playlists that actually *feel*
right instead of a random genre dump.

The tool blends Spotify's `/recommendations` endpoint with a custom vibe-mapping
layer (mood → audio features, genre → curated seed artists, energy slider →
target energy/valence/tempo) and ships with a few DJ-centric extras:

- **DJ Set Mode** — orders the result into a smooth BPM/energy ramp so you can
  hit play and go.
- **Label Mode** — biases seeds toward MoBlack / Keinemusik / Dawn Patrol-style
  artists for that signature organic-afro-melodic sound.
- **Underground Mode** — filters out anything above a popularity threshold so
  the playlist leans toward lesser-known gems.
- **Track-Alike** — paste a Spotify track link and get similar-feeling tracks.

## Stack

- **Frontend**: Next.js (React), dark minimal UI inspired by Ableton / Traktor
- **Backend**: Node.js + Express, Spotify Web API, in-memory rate limiter
- **Auth**: Spotify OAuth 2.0 Authorization Code Flow (PKCE-safe state)

## Project structure

```
vibe-playlist-generator/
├── README.md
├── .gitignore
├── server/                     # Express API
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── index.js            # Express entry + CORS + session
│       ├── config.js           # Env + constants
│       ├── routes/
│       │   ├── auth.js         # /login /callback /refresh /me /logout
│       │   ├── recommendations.js  # /generate /track-alike /dj-set
│       │   └── playlist.js     # /save
│       ├── services/
│       │   ├── spotifyService.js   # Token + API wrapper
│       │   └── rateLimiter.js  # Exponential backoff + 429 handling
│       ├── middleware/
│       │   ├── requireAuth.js
│       │   └── errorHandler.js
│       └── utils/
│           ├── vibeMap.js      # Mood → audio features
│           ├── genrePresets.js # Genre → BPM + seed artists
│           ├── labelPresets.js # Label Mode seeds
│           └── djSet.js        # DJ Set ordering logic
└── client/                     # Next.js app
    ├── package.json
    ├── next.config.js
    ├── .env.local.example
    ├── pages/
    │   ├── _app.js
    │   └── index.js            # Login + vibe form + results
    ├── components/
    │   ├── LoginButton.js
    │   ├── VibeForm.js
    │   ├── TrackList.js
    │   ├── TrackCard.js
    │   ├── EmbedPlayer.js
    │   └── Slider.js
    ├── lib/
    │   └── api.js              # Backend client
    └── styles/
        └── globals.css
```

## Prerequisites

- Node.js 18+
- A Spotify Developer account (free): https://developer.spotify.com/dashboard
- A registered Spotify application with **Client ID** and **Client Secret**
- Add `http://localhost:4000/api/auth/callback` to the app's Redirect URIs

## Setup

### 1. Clone & install

```bash
git clone <this repo>
cd vibe-playlist-generator

# backend
cd server
npm install
cp .env.example .env
# then edit .env with your Spotify credentials

# frontend
cd ../client
npm install
cp .env.local.example .env.local
```

### 2. Configure `server/.env`

```
PORT=4000
CLIENT_URL=http://localhost:3000
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:4000/api/auth/callback
SESSION_SECRET=change_me_to_a_long_random_string
```

### 3. Configure `client/.env.local`

```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 4. Run both servers

```bash
# Terminal 1
cd server
npm run dev

# Terminal 2
cd client
npm run dev
```

Open http://localhost:3000, click **Connect Spotify**, pick a vibe, and generate.

## How the vibe mapping works

The backend translates UI inputs into Spotify audio-feature targets:

| Input              | Mapping                                                      |
|--------------------|--------------------------------------------------------------|
| Genre              | BPM band + curated seed artists (Afro House → Keinemusik…)   |
| Mood               | `target_valence`, `target_mode`, `target_instrumentalness`   |
| Energy slider 1-10 | `target_energy`, `target_danceability`                       |
| BPM range          | `min_tempo`/`max_tempo`/`target_tempo`                       |
| Underground toggle | `max_popularity=45`                                          |
| Label Mode         | overrides seed_artists with label roster IDs                 |

DJ Set Mode generates a larger pool, then orders tracks by energy ramp and
smooths BPM transitions to keep the set flowing.

## Rate limiting

`server/src/services/rateLimiter.js` wraps every Spotify call with:

- A small in-process token bucket (per client IP)
- Automatic 429 retry using Spotify's `Retry-After` header
- Exponential backoff on 5xx errors

## Scripts

```bash
# server
npm run dev      # nodemon
npm start        # production

# client
npm run dev
npm run build
npm start
```

## Notes

- Tokens are stored in an HTTP-only cookie session — never exposed to the
  browser.
- The `/recommendations` endpoint's `seed_genres` list is limited; for Afro
  House / Melodic Tech we fall back to curated seed artists for better vibe
  accuracy.
- The underground bias is best-effort — Spotify's popularity metric is global
  and can still surface well-known tracks if the seed pool is narrow.
