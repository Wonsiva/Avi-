# Avi Snow — Spotify Fan Outreach App

A web app to find Spotify playlist curators, track outreach, and grow followers.

## Setup

```bash
pip install -r requirements.txt
```

Get a free Spotify API key at https://developer.spotify.com/dashboard — create an app and copy the **Client ID** and **Client Secret**.

```bash
export SPOTIFY_CLIENT_ID=your_id_here
export SPOTIFY_CLIENT_SECRET=your_secret_here
python app.py
```

Then open **http://localhost:5000** in your browser.

## Features

| Tab | What it does |
|---|---|
| **Curator Finder** | Search Spotify for playlist curators who feature similar artists |
| **Outreach Tracker** | Track every curator/blog contact with status management |
| **Blogs & Platforms** | Curated list of music blogs and submission platforms |
| **Analytics** | Charts showing outreach progress by status, type, and time |

## Outreach Status Flow

`identified` → `contacted` → `added` / `declined` / `no_response`
