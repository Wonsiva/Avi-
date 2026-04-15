"""Render scored bets as a human-friendly recommendation report.

The output deliberately reads like a checklist a human could follow on
Kalshi's website to place each hypothetical bet. It is *not* an order: the
app never connects to a brokerage, never moves money, and the CLI prints a
disclaimer.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable

from .scoring import ScoredBet

DISCLAIMER = (
    "This tool is for educational/research purposes only. It does not place "
    "real orders, is not investment advice, and the scoring heuristic does "
    "not predict outcomes. Always do your own research before risking money."
)


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


def _format_bet(rank: int, bet: ScoredBet, stake_dollars: float) -> str:
    contracts = max(1, int((stake_dollars * 100) // max(1, bet.price_cents)))
    cost = contracts * bet.price_cents / 100.0
    profit = contracts * (100 - bet.price_cents) / 100.0
    payout = contracts * 1.0
    market_url = (
        f"https://kalshi.com/markets/{bet.event_ticker.lower()}/{bet.ticker.lower()}"
        if bet.event_ticker
        else f"https://kalshi.com/markets/{bet.ticker.lower()}"
    )
    other_side = "NO" if bet.side == "YES" else "YES"

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
    lines.append(f"        2. Open the market: {market_url}")
    lines.append(
        f"        3. Place a {bet.side} limit order for {contracts} contracts "
        f"at {bet.price_cents}¢ each (total cost ${cost:.2f})"
    )
    lines.append(
        f"        4. If the market resolves {bet.side}, you receive "
        f"${payout:.2f} (net profit ${profit:.2f}, a {bet.payout_multiple:.2f}x return)"
    )
    lines.append(
        f"        5. If it resolves {other_side}, the contracts expire "
        f"worthless (net loss ${cost:.2f})"
    )
    return "\n".join(lines)


def format_recommendations(
    bets: Iterable[ScoredBet],
    *,
    stake_dollars: float = 10.0,
    header: str | None = None,
) -> str:
    """Format the ranked list of bets as a printable report."""
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
        out.append(_format_bet(i, bet, stake_dollars))
        out.append("")
    out.append("-" * 72)
    out.append(DISCLAIMER)
    return "\n".join(out)
