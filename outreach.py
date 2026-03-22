#!/usr/bin/env python3
"""
Spotify Fan Outreach Automation for Avi Snow
Finds playlist curators and potential fans via Spotify API, tracks outreach.
"""

import os
import csv
import json
import time
import argparse
import datetime
import webbrowser
from pathlib import Path

try:
    import requests
except ImportError:
    print("Install dependencies: pip install requests")
    raise

OUTREACH_FILE = "outreach_log.csv"
OUTREACH_FIELDS = ["date", "type", "name", "contact", "platform", "status", "notes"]

SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize"
SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_API_BASE = "https://api.spotify.com/v1"


# ── Spotify API helpers ────────────────────────────────────────────────────────

def get_client_credentials_token(client_id: str, client_secret: str) -> str:
    """Get a Spotify API token via client credentials flow (no user login needed)."""
    resp = requests.post(
        SPOTIFY_TOKEN_URL,
        data={"grant_type": "client_credentials"},
        auth=(client_id, client_secret),
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def spotify_get(token: str, path: str, params: dict = None) -> dict:
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(f"{SPOTIFY_API_BASE}{path}", headers=headers, params=params, timeout=10)
    if resp.status_code == 429:
        retry_after = int(resp.headers.get("Retry-After", 5))
        print(f"  Rate limited — waiting {retry_after}s...")
        time.sleep(retry_after)
        return spotify_get(token, path, params)
    resp.raise_for_status()
    return resp.json()


# ── Core features ──────────────────────────────────────────────────────────────

def find_artist(token: str, name: str) -> dict | None:
    """Search Spotify for an artist by name, return the top match."""
    data = spotify_get(token, "/search", {"q": name, "type": "artist", "limit": 5})
    items = data.get("artists", {}).get("items", [])
    if not items:
        return None
    # Prefer exact match
    for item in items:
        if item["name"].lower() == name.lower():
            return item
    return items[0]


def get_related_artists(token: str, artist_id: str) -> list[dict]:
    data = spotify_get(token, f"/artists/{artist_id}/related-artists")
    return data.get("artists", [])


def search_playlists_for_artist(token: str, artist_name: str, limit: int = 20) -> list[dict]:
    """Find public playlists that mention the artist name or genre keywords."""
    data = spotify_get(token, "/search", {
        "q": artist_name,
        "type": "playlist",
        "limit": limit,
    })
    return data.get("playlists", {}).get("items", []) or []


def get_playlist_details(token: str, playlist_id: str) -> dict:
    return spotify_get(token, f"/playlists/{playlist_id}", {
        "fields": "id,name,description,followers,owner,external_urls,tracks.total"
    })


def find_curators(token: str, artist_name: str, related_names: list[str], limit_per_query: int = 10) -> list[dict]:
    """
    Find playlist curators by searching playlists that feature the artist
    or similar artists. Returns a list of curator info dicts.
    """
    seen_owners = set()
    curators = []
    queries = [artist_name] + related_names[:4]

    for query in queries:
        playlists = search_playlists_for_artist(token, query, limit=limit_per_query)
        for pl in playlists:
            if pl is None:
                continue
            owner = pl.get("owner", {})
            owner_id = owner.get("id", "")
            if not owner_id or owner_id in seen_owners or owner_id == "spotify":
                continue
            seen_owners.add(owner_id)
            followers = pl.get("followers", {}).get("total", 0) if "followers" in pl else "?"
            curators.append({
                "playlist_name": pl.get("name", ""),
                "playlist_id": pl.get("id", ""),
                "playlist_url": pl.get("external_urls", {}).get("spotify", ""),
                "owner_id": owner_id,
                "owner_display": owner.get("display_name") or owner_id,
                "owner_url": f"https://open.spotify.com/user/{owner_id}",
                "followers": followers,
                "found_via": query,
            })

    curators.sort(key=lambda x: x["followers"] if isinstance(x["followers"], int) else 0, reverse=True)
    return curators


def search_blogs(genre_keywords: list[str]) -> list[dict]:
    """
    Return a curated list of music blog / submission platforms relevant to
    indie/alternative artists, pre-filtered by genre keywords.
    (Live web scraping is outside Spotify's API scope — this provides a
    starting list you can expand.)
    """
    all_blogs = [
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
        {"name": "Purple Sneakers", "url": "https://www.purplesneakers.com.au", "type": "blog", "genres": ["indie", "electronic", "pop"]},
        {"name": "Soundigest", "url": "https://soundigest.com/submit-music", "type": "blog", "genres": ["indie", "pop", "alternative"]},
        {"name": "Music Blog Reddit (r/spotify)", "url": "https://www.reddit.com/r/spotify", "type": "community", "genres": ["all"]},
        {"name": "r/indieheads", "url": "https://www.reddit.com/r/indieheads", "type": "community", "genres": ["indie", "alternative"]},
        {"name": "r/WeAreTheMusicMakers", "url": "https://www.reddit.com/r/WeAreTheMusicMakers", "type": "community", "genres": ["all"]},
    ]
    kw_lower = [k.lower() for k in genre_keywords]
    if not kw_lower:
        return all_blogs
    filtered = [b for b in all_blogs if "all" in b["genres"] or any(k in b["genres"] for k in kw_lower)]
    return filtered


# ── Outreach log ───────────────────────────────────────────────────────────────

def load_log() -> list[dict]:
    if not Path(OUTREACH_FILE).exists():
        return []
    with open(OUTREACH_FILE, newline="") as f:
        return list(csv.DictReader(f))


def save_log(entries: list[dict]):
    with open(OUTREACH_FILE, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=OUTREACH_FIELDS)
        writer.writeheader()
        writer.writerows(entries)


def add_to_log(entries: list[dict], new_entry: dict):
    entries.append({**{f: "" for f in OUTREACH_FIELDS}, **new_entry,
                    "date": new_entry.get("date") or datetime.date.today().isoformat()})


def print_log(entries: list[dict]):
    if not entries:
        print("No outreach logged yet.")
        return
    statuses = {}
    for e in entries:
        statuses[e.get("status", "unknown")] = statuses.get(e.get("status", "unknown"), 0) + 1
    print(f"\n{'─'*60}")
    print(f"  Outreach Log  ({len(entries)} total)")
    print(f"{'─'*60}")
    for s, count in statuses.items():
        print(f"  {s:<20} {count}")
    print(f"{'─'*60}")
    for e in entries[-20:]:  # show last 20
        print(f"  [{e.get('date','')}] {e.get('type',''):12} {e.get('name',''):30} {e.get('status','')}")
    print()


# ── CLI ────────────────────────────────────────────────────────────────────────

def cmd_find(args):
    client_id = args.client_id or os.environ.get("SPOTIFY_CLIENT_ID")
    client_secret = args.client_secret or os.environ.get("SPOTIFY_CLIENT_SECRET")
    if not client_id or not client_secret:
        print("Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET env vars, or pass --client-id / --client-secret.")
        return

    print(f"\nAuthenticating with Spotify...")
    token = get_client_credentials_token(client_id, client_secret)

    artist_name = args.artist or "Avi Snow"
    print(f"Looking up artist: {artist_name}")
    artist = find_artist(token, artist_name)
    if not artist:
        print(f"Artist '{artist_name}' not found on Spotify.")
        return

    print(f"Found: {artist['name']}  (ID: {artist['id']})  Followers: {artist['followers']['total']:,}")
    genres = artist.get("genres", [])
    print(f"Genres: {', '.join(genres) or 'none listed'}")

    print("\nFinding related artists...")
    related = get_related_artists(token, artist["id"])
    related_names = [r["name"] for r in related[:5]]
    print(f"  Related: {', '.join(related_names)}")

    print(f"\nSearching for playlist curators (this may take a moment)...")
    curators = find_curators(token, artist_name, related_names, limit_per_query=args.limit)

    print(f"\nFound {len(curators)} unique curators:\n")
    print(f"  {'Playlist':<35} {'Curator':<25} {'Followers':>10}  URL")
    print(f"  {'─'*35} {'─'*25} {'─'*10}  {'─'*40}")
    for c in curators[:args.top]:
        print(f"  {c['playlist_name'][:34]:<35} {c['owner_display'][:24]:<25} {str(c['followers']):>10}  {c['playlist_url']}")

    if args.save:
        log = load_log()
        for c in curators:
            add_to_log(log, {
                "type": "playlist_curator",
                "name": c["playlist_name"],
                "contact": c["owner_url"],
                "platform": "spotify",
                "status": "identified",
                "notes": f"owner={c['owner_display']} followers={c['followers']} via={c['found_via']}",
            })
        save_log(log)
        print(f"\nSaved {len(curators)} curators to {OUTREACH_FILE}")

    if args.blogs:
        print(f"\n{'─'*60}")
        print("  Recommended Blog / Submission Platforms")
        print(f"{'─'*60}")
        blogs = search_blogs(genres)
        for b in blogs:
            print(f"  [{b['type']:10}] {b['name']:<30}  {b['url']}")
        if args.save:
            log = load_log()
            for b in blogs:
                add_to_log(log, {
                    "type": b["type"],
                    "name": b["name"],
                    "contact": b["url"],
                    "platform": "web",
                    "status": "identified",
                })
            save_log(log)


def cmd_log(args):
    log = load_log()

    if args.add:
        # e.g. --add "playlist_curator,Cool Playlist,http://...,spotify,contacted,First message sent"
        parts = args.add.split(",", 5)
        fields = OUTREACH_FIELDS[1:]  # skip date
        entry = {fields[i]: parts[i].strip() if i < len(parts) else "" for i in range(len(fields))}
        add_to_log(log, entry)
        save_log(log)
        print(f"Added entry: {entry['name']}")

    elif args.update:
        # --update <name> <status>
        name, status = args.update[0], args.update[1]
        found = False
        for e in log:
            if e["name"].lower() == name.lower():
                e["status"] = status
                found = True
        if found:
            save_log(log)
            print(f"Updated '{name}' → {status}")
        else:
            print(f"No entry found for '{name}'")

    else:
        print_log(log)


def cmd_open(args):
    """Open curator URLs in the browser for manual outreach."""
    log = load_log()
    targets = [e for e in log if e.get("status") == "identified" and e.get("type") == "playlist_curator"]
    if not targets:
        print("No identified curators in log. Run 'find --save' first.")
        return
    print(f"Opening {min(args.n, len(targets))} curator profiles in browser...")
    for e in targets[:args.n]:
        print(f"  {e['name']}  {e['contact']}")
        webbrowser.open(e["contact"])
        time.sleep(1)


def main():
    parser = argparse.ArgumentParser(
        description="Spotify fan outreach automation for Avi Snow",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Find curators and blogs, save to outreach_log.csv
  python outreach.py find --save --blogs

  # Show outreach log summary
  python outreach.py log

  # Add a manual entry
  python outreach.py log --add "blog,Indie Shuffle,https://indieshuffle.com,web,contacted,Submitted via form"

  # Update status
  python outreach.py log --update "Indie Shuffle" added

  # Open top 5 curator profiles in browser for manual outreach
  python outreach.py open --n 5
""",
    )
    sub = parser.add_subparsers(dest="command")

    # find
    p_find = sub.add_parser("find", help="Find playlist curators and blogs")
    p_find.add_argument("--artist", default="Avi Snow", help="Artist name to search for")
    p_find.add_argument("--limit", type=int, default=10, help="Playlists to fetch per query")
    p_find.add_argument("--top", type=int, default=30, help="Top curators to display")
    p_find.add_argument("--save", action="store_true", help="Save results to outreach log")
    p_find.add_argument("--blogs", action="store_true", help="Also show blog/platform list")
    p_find.add_argument("--client-id", help="Spotify Client ID (or set SPOTIFY_CLIENT_ID)")
    p_find.add_argument("--client-secret", help="Spotify Client Secret (or set SPOTIFY_CLIENT_SECRET)")
    p_find.set_defaults(func=cmd_find)

    # log
    p_log = sub.add_parser("log", help="View or update outreach log")
    p_log.add_argument("--add", help="Add entry: type,name,contact,platform,status,notes")
    p_log.add_argument("--update", nargs=2, metavar=("NAME", "STATUS"), help="Update status of an entry")
    p_log.set_defaults(func=cmd_log)

    # open
    p_open = sub.add_parser("open", help="Open curator URLs in browser")
    p_open.add_argument("--n", type=int, default=5, help="Number of profiles to open")
    p_open.set_defaults(func=cmd_open)

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return
    args.func(args)


if __name__ == "__main__":
    main()
