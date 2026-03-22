# Avi Snow — Spotify Fan Outreach Tool

Finds playlist curators and music blogs to pitch your music to, then tracks your outreach in a CSV log.

## Setup

```bash
pip install -r requirements.txt
```

Get a free Spotify API key at https://developer.spotify.com/dashboard — create an app and copy the **Client ID** and **Client Secret**.

```bash
export SPOTIFY_CLIENT_ID=your_id_here
export SPOTIFY_CLIENT_SECRET=your_secret_here
```

## Usage

### 1. Find curators and blogs

```bash
python outreach.py find --save --blogs
```

This:
- Looks up Avi Snow on Spotify
- Finds related artists
- Searches for playlist curators featuring similar artists
- Lists music blogs and submission platforms
- Saves everything to `outreach_log.csv`

### 2. View your outreach log

```bash
python outreach.py log
```

### 3. Open curator profiles in your browser (for manual outreach)

```bash
python outreach.py open --n 10
```

### 4. Update status after reaching out

```bash
python outreach.py log --update "Playlist Name" contacted
python outreach.py log --update "Playlist Name" added
```

**Status flow:** `identified` → `contacted` → `added` / `declined` / `no_response`

### 5. Add a manual entry

```bash
python outreach.py log --add "blog,Indie Shuffle,https://indieshuffle.com,web,contacted,Submitted via form"
```

## Outreach Tips

1. **Playlist curators** — reach out via Spotify's built-in contact, their bio links, or social media
2. **SubmitHub / Groover** — paid platforms with direct curator access (best ROI)
3. **Reddit** — post in r/indieheads, r/spotify new music threads
4. **Spotify for Artists** — pitch your next release to editorial playlists via the pitch tool
