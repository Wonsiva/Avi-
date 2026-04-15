"""Score Kalshi markets by "upside relative to likelihood".

The scoring problem
-------------------
Each Kalshi binary market lets you buy a YES contract or a NO contract.
A contract that pays out is worth $1.00 (100 cents); a contract that loses
expires worthless. If you pay ``p`` cents for a side, you are implicitly
saying the market thinks that side has a ``p / 100`` probability of winning,
and your potential payout multiple on a win is ``(100 - p) / p``.

The user wants the bets with the *largest potential upside relative to the
likelihood of the bet succeeding*. In a perfectly efficient market the
expected value of every contract is zero, so we need a heuristic that picks
out the bets with the most appealing risk/reward shape rather than literal
positive EV. We use a "sweet-spot" score:

    interestingness(p) = (1 - p) ** ALPHA  *  p ** BETA

with ``ALPHA = 0.5`` and ``BETA = 0.2``. This curve peaks near
``p ~= 0.286`` (a ~3.5x payout at ~29% implied probability) and falls off
smoothly toward the extremes, so we naturally surface bets that pay
multiples of the stake but still have a meaningful chance of winning rather
than pure lottery tickets or near-certain low-yield bets.

We then multiply by a liquidity factor (favoring markets with real volume
behind them, so the recommendation is actually tradable) and a mild urgency
factor (favoring markets that resolve sooner, which makes the action plan
concrete).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Iterable

# Tunable scoring weights. Exposed as module-level constants so tests and
# downstream callers can introspect them.
ALPHA: float = 0.5  # weight on potential upside (1 - p)
BETA: float = 0.2  # weight on likelihood (p)
LIQUIDITY_REFERENCE_VOLUME: float = 5_000.0
URGENCY_HORIZON_DAYS: float = 60.0
MAX_URGENCY_BONUS: float = 0.25  # up to +25% boost for very near-term resolution


@dataclass(frozen=True)
class ScoredBet:
    """A single recommended side of a Kalshi market."""

    ticker: str
    event_ticker: str
    title: str
    side: str  # "YES" or "NO"
    price_cents: int  # ask price for the chosen side
    implied_probability: float
    payout_multiple: float  # profit / cost on a win
    volume: int
    open_interest: int
    close_time: str | None
    category: str | None
    score: float
    components: dict[str, float] = field(default_factory=dict)

    @property
    def profit_per_contract_cents(self) -> int:
        return 100 - int(self.price_cents)

    @property
    def implied_probability_pct(self) -> float:
        return self.implied_probability * 100.0


def _liquidity_factor(volume: float) -> float:
    """Map raw trading volume to a (0, 1] multiplier."""
    if volume <= 0:
        return 0.05
    # log curve: ~0.3 at 50, ~0.6 at 500, ~1.0 at 5000+
    return min(1.0, math.log10(volume + 10.0) / math.log10(LIQUIDITY_REFERENCE_VOLUME))


def _urgency_factor(close_time: str | None, now: datetime | None = None) -> float:
    """Mildly favor markets that resolve soon.

    Returns a multiplier in ``[1.0, 1 + MAX_URGENCY_BONUS]``. Markets that
    close within a day get the maximum bonus; markets that close beyond the
    horizon get no bonus.
    """
    if not close_time:
        return 1.0
    try:
        dt = datetime.fromisoformat(close_time.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return 1.0
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    current = now or datetime.now(timezone.utc)
    days_to_close = (dt - current).total_seconds() / 86400.0
    if days_to_close <= 0 or days_to_close >= URGENCY_HORIZON_DAYS:
        # Past-close markets shouldn't get the near-term boost; far-out
        # markets don't either.
        return 1.0
    # Linear from full bonus at 0 days to no bonus at horizon.
    return 1.0 + MAX_URGENCY_BONUS * (1.0 - days_to_close / URGENCY_HORIZON_DAYS)


def _interestingness(probability: float) -> float:
    """Sweet-spot curve over implied probability.

    Peaks at ``p = BETA / (ALPHA + BETA)``, which for the defaults sits at
    ~0.286 — a ~3.5x payout at ~29% implied probability.
    """
    if probability <= 0.0 or probability >= 1.0:
        return 0.0
    return (1.0 - probability) ** ALPHA * probability ** BETA


def _score_side(market: dict, side: str, ask_cents: float) -> ScoredBet | None:
    if not (1 < ask_cents < 100):
        return None
    probability = ask_cents / 100.0
    payout_multiple = (100.0 - ask_cents) / ask_cents
    interestingness = _interestingness(probability)
    if interestingness <= 0:
        return None
    volume = float(market.get("volume") or 0)
    liquidity = _liquidity_factor(volume)
    urgency = _urgency_factor(market.get("close_time"))
    score = interestingness * liquidity * urgency
    return ScoredBet(
        ticker=str(market.get("ticker") or ""),
        event_ticker=str(market.get("event_ticker") or ""),
        title=str(market.get("title") or market.get("ticker") or "Untitled market"),
        side=side,
        price_cents=int(ask_cents),
        implied_probability=probability,
        payout_multiple=payout_multiple,
        volume=int(volume),
        open_interest=int(market.get("open_interest") or 0),
        close_time=market.get("close_time"),
        category=market.get("category"),
        score=score,
        components={
            "interestingness": interestingness,
            "liquidity": liquidity,
            "urgency": urgency,
        },
    )


def score_markets(
    markets: Iterable[dict],
    *,
    top: int = 3,
    min_volume: int = 0,
    max_per_event: int = 1,
) -> list[ScoredBet]:
    """Score every tradable side of every market and return the top picks.

    ``min_volume`` filters out markets below the given trading volume.
    ``max_per_event`` caps how many bets we recommend from the same Kalshi
    event ticker — without this the YES and NO sides of the same market, or
    multiple highly-correlated outcomes within a single event, can crowd out
    the rest of the list.
    """
    candidates: list[ScoredBet] = []
    for market in markets:
        if (market.get("volume") or 0) < min_volume:
            continue
        yes_ask = market.get("yes_ask")
        no_ask = market.get("no_ask")
        if isinstance(yes_ask, (int, float)):
            bet = _score_side(market, "YES", float(yes_ask))
            if bet is not None:
                candidates.append(bet)
        if isinstance(no_ask, (int, float)):
            bet = _score_side(market, "NO", float(no_ask))
            if bet is not None:
                candidates.append(bet)

    candidates.sort(key=lambda b: b.score, reverse=True)

    picked: list[ScoredBet] = []
    per_event: dict[str, int] = {}
    per_market: dict[str, int] = {}
    for bet in candidates:
        event_key = bet.event_ticker or bet.ticker
        if per_event.get(event_key, 0) >= max_per_event:
            continue
        # Never recommend both sides of the same market.
        if per_market.get(bet.ticker, 0) >= 1:
            continue
        picked.append(bet)
        per_event[event_key] = per_event.get(event_key, 0) + 1
        per_market[bet.ticker] = 1
        if len(picked) >= top:
            break
    return picked
