# Kalshi bet recommender

## [View Today's Top Picks](PICKS.md)

A tiny Python app that pulls live market data from [Kalshi](https://kalshi.com),
ranks every open binary market by an "upside relative to likelihood"
heuristic, and prints the **top 3 most interesting bets** along with
hypothetical step-by-step instructions for placing each one.

> **Disclaimer.** This tool is for educational/research purposes only. It
> does **not** place real orders, is **not** investment advice, and the
> scoring heuristic does **not** predict outcomes. Always do your own
> research before risking money.

## What it does

1. Calls Kalshi's public, unauthenticated `GET /markets` endpoint and walks
   the cursor pagination until it has up to ~1000 open markets.
2. Filters out closed markets, non-binary markets, and markets whose order
   book is at the extremes (1¢ or 99¢) where there is either no upside or
   no realistic chance of winning.
3. Scores each side (YES *and* NO) of every market using:

   ```
   score = (1 - p)^0.5 * p^0.2  *  liquidity_factor  *  urgency_factor
   ```

   where `p` is the side's ask price as a probability. The curve peaks
   near `p ≈ 0.286` — i.e. a ~3.5x payout at ~29% implied probability —
   so the recommender naturally favors bets that pay multiples of the
   stake but still have a meaningful chance of winning (rather than pure
   lottery tickets or near-certain low-yield bets).
4. Caps recommendations to at most one bet per Kalshi event so the top
   list isn't flooded by every team in a single championship market.
5. Prints the top picks with category, price, payout multiple, volume,
   and a numbered hypothetical action plan including a direct Kalshi URL.

## I just want to look at the picks

There is a pre-rendered HTML page at [`docs/index.html`](docs/index.html).
Once you enable GitHub Pages on this repo (one click — see
**[Publishing the page at a public URL](#publishing-the-page-at-a-public-url)**
below), that page becomes a real website that auto-refreshes every morning.

## Install

```bash
pip install -e .
# or, without installing the package:
pip install -r requirements.txt
```

Requires Python 3.11+. There are no third-party runtime dependencies — the
client uses `urllib` from the standard library.

## Usage

```bash
# Live: pull from the real Kalshi API
kalshi-recommender

# Offline: use the bundled sample of Kalshi-shaped markets
kalshi-recommender --sample

# Tweak the recommendations
kalshi-recommender --top 5 --min-volume 1000 --stake 25
```

Or run the module directly without installing:

```bash
python -m kalshi_recommender.cli --sample
```

### Options

| Flag | Default | Description |
|---|---|---|
| `--top N` | 3 | Number of bets to recommend |
| `--min-volume N` | 200 | Skip markets with less than N contracts of 24h volume |
| `--stake D` | 10 | Hypothetical $ stake per bet for the action plan |
| `--max-markets N` | 1000 | Cap on how many markets to pull from the API |
| `--base-url URL` | api.elections.kalshi.com | Override the API base URL |
| `--timeout S` | 10 | HTTP timeout in seconds |
| `--sample` | off | Use bundled sample data instead of calling the API |
| `--format` | text | Output format: `text`, `html`, or `json` |
| `--output PATH` | stdout | Write the output to a file instead of stdout |

### Other output formats

```bash
# Generate the styled webpage
kalshi-recommender --format html --output docs/index.html

# Get the raw recommendations as JSON for downstream automation
kalshi-recommender --format json
```

### Example output

```
Kalshi bet recommender — analyzed 15 tradable markets from bundled sample data.

Top 3 most interesting Kalshi bets (hypothetical $10 stake per bet)
========================================================================

#1  FEDRATE-25DEC-T4.25  —  Will the Federal Reserve cut rates by 25bps...
      Category: Economics
      Recommended: BUY YES at 28¢ (implied probability 28.0%)
      Potential payout: 2.57x your stake (profit 72¢ per contract on a win)
      Market closes: 2025-12-10 19:00 UTC (closed)
      24h volume: 18,420 contracts  |  open interest: 9,210
      Score: 0.812 (interestingness 0.65, liquidity 0.95, urgency 1.25)

      How to place this bet (hypothetically):
        1. Sign in to Kalshi at https://kalshi.com
        2. Open the market: https://kalshi.com/markets/fedrate-25dec/...
        3. Place a YES limit order for 35 contracts at 28¢ each (total cost $9.80)
        4. If the market resolves YES, you receive $35.00 (net profit $25.20, a 2.57x return)
        5. If it resolves NO, the contracts expire worthless (net loss $9.80)

[... #2, #3 ...]
```

## Publishing the page at a public URL

The repo includes a pre-rendered `docs/index.html` and a GitHub Actions
workflow (`.github/workflows/refresh-recommendations.yml`) that re-runs
the recommender every day at **12:00 UTC** and commits the updated page.

To make the page live at a real URL — **one-time setup, no signup, no
paid services**:

1. Open the repository on github.com.
2. Click **Settings → Pages** in the left sidebar.
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Set the branch to **`main`** and the folder to **`/docs`**, then click
   **Save**.
5. Wait ~30 seconds. GitHub will show the published URL at the top of the
   same Pages settings page (it looks like
   `https://<your-username>.github.io/<repo-name>/`).

After the page is live:

* The scheduled workflow refreshes `docs/index.html` daily.
* You can also click **Actions → Refresh recommendations → Run workflow**
  to update it on demand. (This is GitHub Actions' built-in
  `workflow_dispatch` trigger — no extra services required.)
* Pull requests automatically run the test suite via
  `.github/workflows/tests.yml`.

> **Note:** GitHub Pages is free for **public** repos. If your repo is
> private it requires a GitHub Pro/Team plan; in that case run
> `kalshi-recommender --format html --output index.html` locally and
> open the file in your browser instead.

## Project layout

```
kalshi_recommender/
  kalshi_client.py    # urllib-based public API client + offline sample loader
  scoring.py          # ranking algorithm (interestingness × liquidity × urgency)
  formatter.py        # text / HTML / JSON renderers with action plans
  cli.py              # argparse entry point with --format and --output
  data/sample_markets.json
docs/
  index.html          # pre-rendered, served via GitHub Pages
  recommendations.json  # (created by the scheduled workflow)
.github/workflows/
  refresh-recommendations.yml  # daily re-render of docs/index.html
  tests.yml                    # pytest on push and PR
tests/
  test_scoring.py
  test_formatter.py
  test_kalshi_client.py
```

## Tests

```bash
pip install -e ".[test]"
pytest
```

The test suite exercises the scoring curve (peak location, monotonicity,
edge cases), the per-event/per-market caps in the ranker, the formatter's
action-plan math, and an end-to-end run against the bundled sample data so
the full pipeline is covered without network access.
