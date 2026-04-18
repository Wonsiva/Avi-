#!/usr/bin/env python3
"""
Avi Snow — Spotify Fan Outreach Web App
Flask backend serving API routes and the single-page frontend.
"""

import csv
import datetime
import json
import os
import time
import uuid
from pathlib import Path

from flask import Flask, jsonify, render_template, request
import requests as http

app = Flask(__name__)

OUTREACH_FILE = Path("outreach_log.csv")
OUTREACH_FIELDS = ["id", "date", "type", "name", "contact", "platform", "status", "notes"]

SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_API_BASE = "https://api.spotify.com/v1"

_token_cache = {"token": None, "expires_at": 0}


# ── Spotify helpers ────────────────────────────────────────────────────────────

def get_token():
    client_id = os.environ.get("SPOTIFY_CLIENT_ID", "")
    client_secret = os.environ.get("SPOTIFY_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        raise ValueError("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set")
    now = time.time()
    if _token_cache["token"] and now < _token_cache["expires_at"] - 30:
        return _token_cache["token"]
    resp = http.post(
        SPOTIFY_TOKEN_URL,
        data={"grant_type": "client_credentials"},
        auth=(client_id, client_secret),
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    _token_cache["token"] = data["access_token"]
    _token_cache["expires_at"] = now + data.get("expires_in", 3600)
    return _token_cache["token"]


def spotify_get(path, params=None):
    token = get_token()
    resp = http.get(
        f"{SPOTIFY_API_BASE}{path}",
        headers={"Authorization": f"Bearer {token}"},
        params=params,
        timeout=10,
    )
    if resp.status_code == 429:
        time.sleep(int(resp.headers.get("Retry-After", 3)))
        return spotify_get(path, params)
    resp.raise_for_status()
    return resp.json()


def find_artist(name):
    data = spotify_get("/search", {"q": name, "type": "artist", "limit": 5})
    items = data.get("artists", {}).get("items", [])
    if not items:
        return None
    for item in items:
        if item["name"].lower() == name.lower():
            return item
    return items[0]


def get_related_artists(artist_id):
    return spotify_get(f"/artists/{artist_id}/related-artists").get("artists", [])


def find_curators(artist_name, related_names, limit=10):
    seen = set()
    curators = []
    for query in [artist_name] + related_names[:4]:
        data = spotify_get("/search", {"q": query, "type": "playlist", "limit": limit})
        for pl in data.get("playlists", {}).get("items", []) or []:
            if not pl:
                continue
            owner = pl.get("owner", {})
            owner_id = owner.get("id", "")
            if not owner_id or owner_id in seen or owner_id == "spotify":
                continue
            seen.add(owner_id)
            curators.append({
                "playlist_name": pl.get("name", ""),
                "playlist_id": pl.get("id", ""),
                "playlist_url": pl.get("external_urls", {}).get("spotify", ""),
                "owner_id": owner_id,
                "owner_display": owner.get("display_name") or owner_id,
                "owner_url": f"https://open.spotify.com/user/{owner_id}",
                "followers": pl.get("followers", {}).get("total", 0) if "followers" in pl else 0,
                "found_via": query,
            })
    curators.sort(key=lambda x: x["followers"], reverse=True)
    return curators


BLOGS = [
    {"name": "SubmitHub", "url": "https://www.submithub.com", "type": "platform", "genres": ["all"]},
    {"name": "Groover", "url": "https://groover.co", "type": "platform", "genres": ["all"]},
    {"name": "Playlist Push", "url": "https://playlistpush.com", "type": "platform", "genres": ["all"]},
    {"name": "Fluence", "url": "https://fluence.io", "type": "platform", "genres": ["all"]},
    {"name": "Indie Shuffle", "url": "https://www.indieshuffle.com/submit", "type": "blog", "genres": ["indie", "alternative", "pop", "folk"]},
    {"name": "Hilly Dilly", "url": "https://hillydilly.com", "type": "blog", "genres": ["indie", "pop", "alternative"]},
    {"name": "The Wild Honey Pie", "url": "https://thewildhoneypie.com/submit", "type": "blog", "genres": ["indie", "folk", "alternative"]},
    {"name": "Pigeons & Planes", "url": "https://pigeonsandplanes.com/submit", "type": "blog", "genres": ["indie", "hip-hop", "r&b", "pop"]},
    {"name": "Ones To Watch", "url": "https://www.ones2watch.com", "type": "blog", "genres": ["pop", "indie", "r&b"]},
    {"name": "Earmilk", "url": "https://www.earmilk.com/submit", "type": "blog", "genres": ["electronic", "indie", "pop", "r&b"]},
    {"name": "Soundigest", "url": "https://soundigest.com/submit-music", "type": "blog", "genres": ["indie", "pop", "alternative"]},
    {"name": "r/indieheads", "url": "https://www.reddit.com/r/indieheads", "type": "community", "genres": ["indie", "alternative"]},
    {"name": "r/spotify", "url": "https://www.reddit.com/r/spotify", "type": "community", "genres": ["all"]},
    {"name": "r/WeAreTheMusicMakers", "url": "https://www.reddit.com/r/WeAreTheMusicMakers", "type": "community", "genres": ["all"]},
]


# ── Outreach log helpers ───────────────────────────────────────────────────────

def load_log():
    if not OUTREACH_FILE.exists():
        return []
    with open(OUTREACH_FILE, newline="") as f:
        return list(csv.DictReader(f))


def save_log(entries):
    with open(OUTREACH_FILE, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=OUTREACH_FIELDS)
        writer.writeheader()
        writer.writerows(entries)


def make_entry(**kwargs):
    return {
        "id": kwargs.get("id") or str(uuid.uuid4())[:8],
        "date": kwargs.get("date") or datetime.date.today().isoformat(),
        "type": kwargs.get("type", ""),
        "name": kwargs.get("name", ""),
        "contact": kwargs.get("contact", ""),
        "platform": kwargs.get("platform", ""),
        "status": kwargs.get("status", "identified"),
        "notes": kwargs.get("notes", ""),
    }


# ── API routes ─────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/curators")
def api_curators():
    artist_name = request.args.get("artist", "Avi Snow")
    try:
        artist = find_artist(artist_name)
        if not artist:
            return jsonify({"error": f"Artist '{artist_name}' not found"}), 404
        related = get_related_artists(artist["id"])
        related_names = [r["name"] for r in related[:5]]
        curators = find_curators(artist_name, related_names)
        return jsonify({
            "artist": {
                "name": artist["name"],
                "id": artist["id"],
                "followers": artist["followers"]["total"],
                "genres": artist.get("genres", []),
                "image": artist["images"][0]["url"] if artist.get("images") else None,
                "url": artist["external_urls"]["spotify"],
            },
            "related": related_names,
            "curators": curators,
        })
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/blogs")
def api_blogs():
    genres = request.args.get("genres", "").lower().split(",")
    if genres == [""]:
        return jsonify(BLOGS)
    filtered = [b for b in BLOGS if "all" in b["genres"] or any(g in b["genres"] for g in genres)]
    return jsonify(filtered)


@app.route("/api/log", methods=["GET"])
def api_log_get():
    return jsonify(load_log())


@app.route("/api/log", methods=["POST"])
def api_log_post():
    data = request.json or {}
    entry = make_entry(**data)
    log = load_log()
    log.append(entry)
    save_log(log)
    return jsonify(entry), 201


@app.route("/api/log/bulk", methods=["POST"])
def api_log_bulk():
    items = request.json or []
    log = load_log()
    existing_contacts = {e["contact"] for e in log}
    added = 0
    for item in items:
        if item.get("contact") not in existing_contacts:
            log.append(make_entry(**item))
            existing_contacts.add(item.get("contact", ""))
            added += 1
    save_log(log)
    return jsonify({"added": added})


@app.route("/api/log/<entry_id>", methods=["PATCH"])
def api_log_patch(entry_id):
    data = request.json or {}
    log = load_log()
    for entry in log:
        if entry["id"] == entry_id:
            entry.update({k: v for k, v in data.items() if k in OUTREACH_FIELDS})
            save_log(log)
            return jsonify(entry)
    return jsonify({"error": "Not found"}), 404


@app.route("/api/log/<entry_id>", methods=["DELETE"])
def api_log_delete(entry_id):
    log = load_log()
    new_log = [e for e in log if e["id"] != entry_id]
    if len(new_log) == len(log):
        return jsonify({"error": "Not found"}), 404
    save_log(new_log)
    return jsonify({"deleted": entry_id})


@app.route("/api/stats")
def api_stats():
    log = load_log()
    by_status = {}
    by_type = {}
    by_month = {}
    for e in log:
        s = e.get("status", "unknown")
        t = e.get("type", "unknown")
        month = e.get("date", "")[:7]
        by_status[s] = by_status.get(s, 0) + 1
        by_type[t] = by_type.get(t, 0) + 1
        by_month[month] = by_month.get(month, 0) + 1
    return jsonify({
        "total": len(log),
        "by_status": by_status,
        "by_type": by_type,
        "by_month": dict(sorted(by_month.items())),
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)
