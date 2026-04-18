"""Render scored bets as a human-friendly recommendation report.

Three output formats are supported so the same recommender can drive a CLI,
a static webpage, and downstream automation:

* :func:`format_recommendations`            – plain text report
* :func:`format_recommendations_html`       – self-contained HTML page
* :func:`format_recommendations_json`       – machine-readable JSON
* :func:`format_recommendations_markdown`   – GitHub-flavored Markdown

All three formats include an explicit educational-only disclaimer; the app
never connects to a brokerage and never moves money.
"""

from __future__ import annotations

import html
import json
from datetime import datetime, timezone
from typing import Iterable

from .scoring import ScoredBet

DISCLAIMER = (
    "This tool is for educational/research purposes only. It does not place "
    "real orders, is not investment advice, and the scoring heuristic does "
    "not predict outcomes. Always do your own research before risking money."
)


# --------------------------------------------------------------------------- #
# Shared helpers                                                              #
# --------------------------------------------------------------------------- #

def _market_url(bet: ScoredBet) -> str:
    if bet.event_ticker:
        return (
            f"https://kalshi.com/markets/{bet.event_ticker.lower()}"
            f"/{bet.ticker.lower()}"
        )
    return f"https://kalshi.com/markets/{bet.ticker.lower()}"


def _bet_plan(bet: ScoredBet, stake_dollars: float) -> dict:
    """Compute the per-bet derived numbers used by every output format."""
    contracts = max(1, int((stake_dollars * 100) // max(1, bet.price_cents)))
    cost = contracts * bet.price_cents / 100.0
    profit = contracts * (100 - bet.price_cents) / 100.0
    payout = contracts * 1.0
    return {
        "contracts": contracts,
        "cost_dollars": cost,
        "profit_dollars": profit,
        "payout_dollars": payout,
        "market_url": _market_url(bet),
        "other_side": "NO" if bet.side == "YES" else "YES",
    }


def _format_close_time(close_time: str | None) -> str:
    if not close_time:
        return "unknown close date"
    try:
        dt = datetime.fromisoformat(close_time.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return close_time
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    delta = dt - now
    days = delta.total_seconds() / 86400.0
    when = dt.strftime("%Y-%m-%d %H:%M UTC")
    if days < 0:
        return f"{when} (closed)"
    if days < 1:
        hours = max(1, int(delta.total_seconds() / 3600))
        return f"{when} (~{hours}h away)"
    return f"{when} (~{int(days)}d away)"


# --------------------------------------------------------------------------- #
# Plain-text format                                                           #
# --------------------------------------------------------------------------- #

def _format_bet_text(rank: int, bet: ScoredBet, stake_dollars: float) -> str:
    plan = _bet_plan(bet, stake_dollars)
    lines: list[str] = []
    lines.append(f"#{rank}  {bet.ticker}  —  {bet.title}")
    if bet.category:
        lines.append(f"      Category: {bet.category}")
    lines.append(
        f"      Recommended: BUY {bet.side} at {bet.price_cents}¢ "
        f"(implied probability {bet.implied_probability_pct:.1f}%)"
    )
    lines.append(
        f"      Potential payout: {bet.payout_multiple:.2f}x your stake "
        f"(profit {bet.profit_per_contract_cents}¢ per contract on a win)"
    )
    lines.append(f"      Market closes: {_format_close_time(bet.close_time)}")
    lines.append(
        f"      24h volume: {bet.volume:,} contracts  |  "
        f"open interest: {bet.open_interest:,}"
    )
    lines.append(
        f"      Score: {bet.score:.3f} "
        f"(interestingness {bet.components.get('interestingness', 0):.2f}, "
        f"liquidity {bet.components.get('liquidity', 0):.2f}, "
        f"urgency {bet.components.get('urgency', 0):.2f})"
    )
    lines.append("")
    lines.append("      How to place this bet (hypothetically):")
    lines.append(f"        1. Sign in to Kalshi at https://kalshi.com")
    lines.append(f"        2. Open the market: {plan['market_url']}")
    lines.append(
        f"        3. Place a {bet.side} limit order for {plan['contracts']} "
        f"contracts at {bet.price_cents}¢ each (total cost ${plan['cost_dollars']:.2f})"
    )
    lines.append(
        f"        4. If the market resolves {bet.side}, you receive "
        f"${plan['payout_dollars']:.2f} (net profit ${plan['profit_dollars']:.2f}, "
        f"a {bet.payout_multiple:.2f}x return)"
    )
    lines.append(
        f"        5. If it resolves {plan['other_side']}, the contracts expire "
        f"worthless (net loss ${plan['cost_dollars']:.2f})"
    )
    return "\n".join(lines)


def format_recommendations(
    bets: Iterable[ScoredBet],
    *,
    stake_dollars: float = 10.0,
    header: str | None = None,
) -> str:
    """Format the ranked list of bets as a plain-text report."""
    bets = list(bets)
    out: list[str] = []
    if header:
        out.append(header)
        out.append("")
    if not bets:
        out.append("No tradable Kalshi markets matched the current filters.")
        out.append("")
        out.append(DISCLAIMER)
        return "\n".join(out)

    out.append(
        f"Top {len(bets)} most interesting Kalshi bets "
        f"(hypothetical $\u200b{stake_dollars:.0f} stake per bet)"
    )
    out.append("=" * 72)
    out.append("")
    for i, bet in enumerate(bets, start=1):
        out.append(_format_bet_text(i, bet, stake_dollars))
        out.append("")
    out.append("-" * 72)
    out.append(DISCLAIMER)
    return "\n".join(out)


# --------------------------------------------------------------------------- #
# JSON format                                                                 #
# --------------------------------------------------------------------------- #

def _bet_to_dict(rank: int, bet: ScoredBet, stake_dollars: float) -> dict:
    plan = _bet_plan(bet, stake_dollars)
    return {
        "rank": rank,
        "ticker": bet.ticker,
        "event_ticker": bet.event_ticker,
        "title": bet.title,
        "category": bet.category,
        "side": bet.side,
        "price_cents": bet.price_cents,
        "implied_probability": round(bet.implied_probability, 4),
        "payout_multiple": round(bet.payout_multiple, 4),
        "profit_per_contract_cents": bet.profit_per_contract_cents,
        "volume": bet.volume,
        "open_interest": bet.open_interest,
        "close_time": bet.close_time,
        "score": round(bet.score, 4),
        "components": {k: round(v, 4) for k, v in bet.components.items()},
        "market_url": plan["market_url"],
        "plan": {
            "stake_dollars": stake_dollars,
            "contracts": plan["contracts"],
            "cost_dollars": round(plan["cost_dollars"], 2),
            "payout_dollars_if_win": round(plan["payout_dollars"], 2),
            "profit_dollars_if_win": round(plan["profit_dollars"], 2),
            "loss_dollars_if_lose": round(plan["cost_dollars"], 2),
        },
    }


def format_recommendations_json(
    bets: Iterable[ScoredBet],
    *,
    stake_dollars: float = 10.0,
    header: str | None = None,
) -> str:
    """Format the ranked list of bets as a JSON document."""
    bets = list(bets)
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "header": header,
        "stake_dollars": stake_dollars,
        "disclaimer": DISCLAIMER,
        "recommendations": [
            _bet_to_dict(i, bet, stake_dollars) for i, bet in enumerate(bets, start=1)
        ],
    }
    return json.dumps(payload, indent=2)


# --------------------------------------------------------------------------- #
# HTML format                                                                 #
# --------------------------------------------------------------------------- #

_HTML_STYLES = """
:root {
  --bg: #0f172a; --panel: #1e293b; --panel-2: #334155; --text: #e2e8f0;
  --muted: #94a3b8; --accent: #38bdf8; --good: #4ade80; --bad: #f87171;
  --border: #334155;
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: var(--bg); color: var(--text); line-height: 1.5;
}
.wrap { max-width: 880px; margin: 0 auto; padding: 32px 20px 80px; }
header { margin-bottom: 28px; }
h1 { margin: 0 0 8px; font-size: 28px; }
.subtitle { color: var(--muted); font-size: 14px; }
.timestamp { color: var(--muted); font-size: 13px; margin-top: 6px; }
.empty { background: var(--panel); padding: 24px; border-radius: 12px; color: var(--muted); }
.bet {
  background: var(--panel); border: 1px solid var(--border); border-radius: 14px;
  padding: 22px; margin-bottom: 18px;
}
.bet-header { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.rank { display: inline-block; background: var(--accent); color: #0b1220; font-weight: 700;
  padding: 2px 10px; border-radius: 999px; font-size: 13px; margin-right: 10px; }
.title { font-size: 18px; font-weight: 600; flex: 1; min-width: 200px; }
.category { color: var(--muted); font-size: 13px; }
.ticker { font-family: SFMono-Regular, Menlo, monospace; font-size: 12px; color: var(--muted); }
.facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px; margin: 16px 0; }
.fact { background: var(--panel-2); border-radius: 8px; padding: 10px 12px; }
.fact-label { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
.fact-value { font-size: 16px; font-weight: 600; margin-top: 2px; }
.side-yes { color: var(--good); }
.side-no { color: var(--bad); }
.plan {
  background: #0b1220; border: 1px solid var(--border); border-radius: 10px;
  padding: 14px 18px; margin-top: 12px;
}
.plan h3 { margin: 0 0 8px; font-size: 14px; color: var(--accent);
  text-transform: uppercase; letter-spacing: 0.05em; }
.plan ol { margin: 0; padding-left: 22px; }
.plan li { margin: 4px 0; font-size: 14px; }
.plan a { color: var(--accent); text-decoration: none; word-break: break-all; }
.plan a:hover { text-decoration: underline; }
.score { color: var(--muted); font-size: 12px; margin-top: 10px; }
footer { margin-top: 32px; padding-top: 18px; border-top: 1px solid var(--border);
  color: var(--muted); font-size: 13px; }
"""


def _format_bet_html(rank: int, bet: ScoredBet, stake_dollars: float) -> str:
    plan = _bet_plan(bet, stake_dollars)
    side_class = "side-yes" if bet.side == "YES" else "side-no"
    title = html.escape(bet.title)
    ticker = html.escape(bet.ticker)
    category = html.escape(bet.category) if bet.category else ""
    market_url = html.escape(plan["market_url"], quote=True)
    other_side = plan["other_side"]
    return f"""
<article class="bet">
  <div class="bet-header">
    <div>
      <span class="rank">#{rank}</span>
      <span class="title">{title}</span>
    </div>
    <div>
      {('<span class="category">' + category + '</span> &middot; ') if category else ''}
      <span class="ticker">{ticker}</span>
    </div>
  </div>

  <div class="facts">
    <div class="fact">
      <div class="fact-label">Recommended</div>
      <div class="fact-value"><span class="{side_class}">BUY {bet.side}</span> @ {bet.price_cents}¢</div>
    </div>
    <div class="fact">
      <div class="fact-label">Implied probability</div>
      <div class="fact-value">{bet.implied_probability_pct:.1f}%</div>
    </div>
    <div class="fact">
      <div class="fact-label">Potential payout</div>
      <div class="fact-value">{bet.payout_multiple:.2f}x</div>
    </div>
    <div class="fact">
      <div class="fact-label">Closes</div>
      <div class="fact-value">{html.escape(_format_close_time(bet.close_time))}</div>
    </div>
    <div class="fact">
      <div class="fact-label">24h volume</div>
      <div class="fact-value">{bet.volume:,}</div>
    </div>
    <div class="fact">
      <div class="fact-label">Open interest</div>
      <div class="fact-value">{bet.open_interest:,}</div>
    </div>
  </div>

  <div class="plan">
    <h3>How to place this bet (hypothetically)</h3>
    <ol>
      <li>Sign in to Kalshi at <a href="https://kalshi.com" target="_blank" rel="noopener">kalshi.com</a>.</li>
      <li>Open the market: <a href="{market_url}" target="_blank" rel="noopener">{market_url}</a></li>
      <li>Place a <strong>{bet.side}</strong> limit order for <strong>{plan['contracts']}</strong> contracts at <strong>{bet.price_cents}¢</strong> each (total cost <strong>${plan['cost_dollars']:.2f}</strong>).</li>
      <li>If the market resolves <strong>{bet.side}</strong>, you receive <strong>${plan['payout_dollars']:.2f}</strong> (net profit ${plan['profit_dollars']:.2f}, a {bet.payout_multiple:.2f}x return).</li>
      <li>If it resolves <strong>{other_side}</strong>, the contracts expire worthless (net loss ${plan['cost_dollars']:.2f}).</li>
    </ol>
  </div>

  <div class="score">
    Score {bet.score:.3f}
    &middot; interestingness {bet.components.get('interestingness', 0):.2f}
    &middot; liquidity {bet.components.get('liquidity', 0):.2f}
    &middot; urgency {bet.components.get('urgency', 0):.2f}
  </div>
</article>
""".strip()


def format_recommendations_html(
    bets: Iterable[ScoredBet],
    *,
    stake_dollars: float = 10.0,
    header: str | None = None,
    page_title: str = "Kalshi bet recommender",
) -> str:
    """Format the ranked list of bets as a self-contained HTML page."""
    bets = list(bets)
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    title = html.escape(page_title)
    subtitle = html.escape(header) if header else ""

    if not bets:
        body = '<div class="empty">No tradable Kalshi markets matched the current filters.</div>'
    else:
        body = "\n".join(
            _format_bet_html(i, bet, stake_dollars)
            for i, bet in enumerate(bets, start=1)
        )

    intro = (
        f"<p class=\"subtitle\">Top {len(bets)} most interesting Kalshi bets, "
        f"sized for a hypothetical ${stake_dollars:.0f} stake per bet.</p>"
        if bets else ""
    )

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<style>{_HTML_STYLES}</style>
</head>
<body>
<div class="wrap">
<header>
<h1>{title}</h1>
{f'<div class="subtitle">{subtitle}</div>' if subtitle else ''}
{intro}
<div class="timestamp">Last updated {generated}</div>
</header>
<main>
{body}
</main>
<footer>{html.escape(DISCLAIMER)}</footer>
</div>
</body>
</html>
"""


# --------------------------------------------------------------------------- #
# Markdown format (renders on GitHub's repo page — no Pages setup needed)     #
# --------------------------------------------------------------------------- #

def _format_bet_markdown(rank: int, bet: ScoredBet, stake_dollars: float) -> str:
    plan = _bet_plan(bet, stake_dollars)
    other_side = plan["other_side"]
    market_url = plan["market_url"]
    category = f" | {bet.category}" if bet.category else ""
    side_emoji = "+" if bet.side == "YES" else "-"

    return f"""### #{rank} — {bet.title}

`{bet.ticker}`{category}

| | |
|---|---|
| **Recommended** | BUY **{bet.side}** at **{bet.price_cents}¢** |
| **Implied probability** | {bet.implied_probability_pct:.1f}% |
| **Potential payout** | **{bet.payout_multiple:.2f}x** your stake |
| **Profit per contract** | {bet.profit_per_contract_cents}¢ |
| **Closes** | {_format_close_time(bet.close_time)} |
| **24h volume** | {bet.volume:,} contracts |
| **Open interest** | {bet.open_interest:,} |

<details>
<summary>How to place this bet (hypothetically)</summary>

1. Sign in to Kalshi at [kalshi.com](https://kalshi.com)
2. Open the market: [{bet.ticker}]({market_url})
3. Place a **{bet.side}** limit order for **{plan['contracts']}** contracts at **{bet.price_cents}¢** each (total cost **${plan['cost_dollars']:.2f}**)
4. If it resolves **{bet.side}** → you receive **${plan['payout_dollars']:.2f}** (profit ${plan['profit_dollars']:.2f}, a {bet.payout_multiple:.2f}x return)
5. If it resolves **{other_side}** → contracts expire worthless (loss ${plan['cost_dollars']:.2f})

</details>"""


def format_recommendations_markdown(
    bets: Iterable[ScoredBet],
    *,
    stake_dollars: float = 10.0,
    header: str | None = None,
) -> str:
    """Format the ranked list of bets as GitHub-flavored Markdown."""
    bets = list(bets)
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    out: list[str] = []

    out.append("# Kalshi Bet Recommender — Today's Top Picks")
    out.append("")
    if header:
        out.append(f"> {header}")
        out.append(">")
    out.append(
        f"> Top {len(bets)} most interesting bets, "
        f"sized for a hypothetical **${stake_dollars:.0f}** stake per bet."
    )
    out.append(f"> Last updated: **{generated}**")
    out.append("")

    if not bets:
        out.append("No tradable Kalshi markets matched the current filters.")
    else:
        out.append("---")
        out.append("")
        for i, bet in enumerate(bets, start=1):
            out.append(_format_bet_markdown(i, bet, stake_dollars))
            out.append("")
            out.append("---")
            out.append("")

    out.append(f"*{DISCLAIMER}*")
    out.append("")
    return "\n".join(out)
