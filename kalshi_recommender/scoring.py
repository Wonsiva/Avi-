"""Multi-signal scoring engine for Kalshi market recommendations.

Instead of a single "sweet-spot curve" the engine now evaluates five
independent signals for each side of every market, then blends them with
weights that depend on the chosen recommendation mode.

Signals
-------
1. **Value** — the original sweet-spot curve peaking near ~29% implied
   probability where payout multiples are high but the bet is still
   plausible.
2. **Momentum** — detects recent price movement. A rising price on the
   cheaper side suggests new information is being priced in, and can
   surface "the smart money is moving" plays.
3. **Underdog** — rewards low-probability bets that have *surprising*
   trading volume. High volume at a low price means real capital is
   being deployed despite the consensus being against the outcome —
   a classic overlooked-underdog signal.
4. **Activity** — high 24h volume relative to open interest means the
   market is "hot" right now, which correlates with actionable timing.
5. **Spread** — a tight bid-ask spread means you can enter and exit
   without losing a lot to the spread.  Wide spreads can signal
   opportunity *or* illiquidity; we apply a mild penalty.

Modes
-----
Each mode re-weights the five signals differently:

* ``best``     — balanced blend (default, aims for category diversity)
* ``underdog`` — heavily weights the underdog + momentum signals;
  filters to p < 0.35
* ``momentum`` — heavily weights momentum + activity
* ``value``    — original behaviour, sweet-spot curve dominated
* ``safe``     — filters to p > 0.55 and ranks by yield × liquidity
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Iterable

# ---------------------------------------------------------------- constants
MODES = ("best", "underdog", "momentum", "value", "safe")

MODE_WEIGHTS: dict[str, dict[str, float]] = {
    "best":     {"value": 0.30, "underdog": 0.25, "momentum": 0.20, "activity": 0.15, "spread": 0.10},
    "underdog": {"value": 0.10, "underdog": 0.50, "momentum": 0.25, "activity": 0.10, "spread": 0.05},
    "momentum": {"value": 0.15, "underdog": 0.10, "momentum": 0.45, "activity": 0.20, "spread": 0.10},
    "value":    {"value": 0.60, "underdog": 0.10, "momentum": 0.10, "activity": 0.10, "spread": 0.10},
    "safe":     {"value": 0.20, "underdog": 0.00, "momentum": 0.15, "activity": 0.30, "spread": 0.35},
}

LIQUIDITY_REFERENCE_VOLUME: float = 5_000.0
URGENCY_HORIZON_DAYS: float = 60.0
MAX_URGENCY_BONUS: float = 0.25


# ---------------------------------------------------------------- data model
@dataclass(frozen=True)
class ScoredBet:
    """A single recommended side of a Kalshi market."""

    ticker: str
    event_ticker: str
    title: str
    side: str  # "YES" or "NO"
    price_cents: int
    implied_probability: float
    payout_multiple: float
    volume: int
    volume_24h: int
    open_interest: int
    close_time: str | None
    category: str | None
    score: float
    signals: dict[str, float] = field(default_factory=dict)
    narrative: str = ""
    mode: str = "best"

    @property
    def profit_per_contract_cents(self) -> int:
        return 100 - int(self.price_cents)

    @property
    def implied_probability_pct(self) -> float:
        return self.implied_probability * 100.0


# --------------------------------------------------- individual signal fns

def _value_signal(p: float) -> float:
    """Sweet-spot curve: ``(1-p)^0.5 * p^0.2``, peaks near p=0.286."""
    if p <= 0.0 or p >= 1.0:
        return 0.0
    return (1.0 - p) ** 0.5 * p ** 0.2


def _momentum_signal(market: dict, side: str) -> float:
    """Detect recent price movement toward the recommended side.

    Returns a value in roughly [-1, +1]. Positive = price is rising for
    this side (bullish signal); negative = price is falling.
    """
    last = market.get("last_price")
    prev = market.get("previous_price")
    if last is None or prev is None or prev <= 0:
        return 0.0
    raw = (last - prev) / prev
    if side == "NO":
        raw = -raw
    return max(-1.0, min(1.0, raw * 3.0))


def _underdog_signal(market: dict, p: float) -> float:
    """Reward low-probability bets with surprisingly high volume.

    The intuition: if a contract is cheap (low p) but lots of people are
    buying it anyway (high volume), it may be an overlooked opportunity.
    We measure volume-per-penny-of-cost and scale by (1-p) so true
    longshots get the biggest boost.
    """
    if p >= 0.40:
        return 0.0
    volume = float(market.get("volume") or market.get("volume_24h") or 0)
    if volume <= 0:
        return 0.0
    price_cents = max(1, int(p * 100))
    volume_per_cent = volume / price_cents
    return min(1.0, (1.0 - p) * math.log10(volume_per_cent + 1) / 4.0)


def _activity_signal(market: dict) -> float:
    """High recent volume vs open interest = market is 'hot'."""
    vol24 = float(market.get("volume_24h") or market.get("volume") or 0)
    oi = float(market.get("open_interest") or 1)
    if oi <= 0:
        oi = 1.0
    ratio = vol24 / oi
    return min(1.0, ratio)


def _spread_signal(market: dict, side: str) -> float:
    """Tight bid-ask spread = efficient; wide = penalty.

    Returns a value in (0, 1] where 1 = minimal spread.
    """
    if side == "YES":
        bid = market.get("yes_bid") or 0
        ask = market.get("yes_ask") or 0
    else:
        bid = market.get("no_bid") or 0
        ask = market.get("no_ask") or 0
    if bid <= 0 or ask <= 0:
        return 0.5
    spread = max(0, ask - bid)
    return max(0.1, 1.0 - spread / 15.0)


# ------------------------------------------------------ liquidity / urgency

def _liquidity_factor(volume: float) -> float:
    if volume <= 0:
        return 0.05
    return min(1.0, math.log10(volume + 10.0) / math.log10(LIQUIDITY_REFERENCE_VOLUME))


def _urgency_factor(close_time: str | None, now: datetime | None = None) -> float:
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
        return 1.0
    return 1.0 + MAX_URGENCY_BONUS * (1.0 - days_to_close / URGENCY_HORIZON_DAYS)


# -------------------------------------------------------- narrative builder

def _generate_narrative(
    bet_side: str,
    p: float,
    payout_multiple: float,
    signals: dict[str, float],
) -> str:
    """Build a short, human-readable explanation of why this pick stands out."""
    parts: list[str] = []

    if signals.get("underdog", 0) > 0.25:
        parts.append(
            f"Overlooked underdog — only {p * 100:.0f}% implied odds but "
            f"trading volume suggests real conviction behind this outcome"
        )
    if signals.get("momentum", 0) > 0.15:
        parts.append("price has been climbing recently, suggesting new favorable information")
    elif signals.get("momentum", 0) < -0.10:
        parts.append(
            "price dipped recently — potential buying opportunity "
            "if you believe the fundamentals haven't changed"
        )
    if signals.get("activity", 0) > 0.6:
        parts.append("unusually active market right now with heavy recent trading")
    if signals.get("spread", 0) > 0.85:
        parts.append("tight bid-ask spread means you can enter and exit efficiently")
    if signals.get("value", 0) > 0.55:
        parts.append(
            f"strong risk-reward sweet spot at {payout_multiple:.1f}x payout "
            f"with {p * 100:.0f}% chance of winning"
        )
    if p > 0.55 and payout_multiple > 0.3:
        parts.append(
            f"majority implied probability ({p * 100:.0f}%) with a "
            f"{payout_multiple:.1f}x return makes this a lower-risk play"
        )

    if not parts:
        parts.append(
            f"{payout_multiple:.1f}x potential return at {p * 100:.0f}% implied probability"
        )

    narrative = parts[0]
    if len(parts) > 1:
        narrative += ". Also: " + "; ".join(parts[1:])
    if not narrative.endswith("."):
        narrative += "."
    return narrative[0].upper() + narrative[1:]


# -------------------------------------------------------- composite scoring

def _score_side(
    market: dict,
    side: str,
    ask_cents: float,
    mode: str,
) -> ScoredBet | None:
    if not (2 < ask_cents < 99):
        return None

    p = ask_cents / 100.0
    payout_multiple = (100.0 - ask_cents) / ask_cents

    if mode == "safe" and p < 0.55:
        return None
    if mode == "underdog" and p > 0.35:
        return None

    signals = {
        "value": _value_signal(p),
        "momentum": _momentum_signal(market, side),
        "underdog": _underdog_signal(market, p),
        "activity": _activity_signal(market),
        "spread": _spread_signal(market, side),
    }

    weights = MODE_WEIGHTS[mode]
    raw = sum(weights[k] * max(0.0, signals[k]) for k in weights)

    volume = float(market.get("volume") or 0)
    liq = _liquidity_factor(volume)
    urg = _urgency_factor(market.get("close_time"))
    score = raw * liq * urg

    vol24 = int(market.get("volume_24h") or market.get("volume") or 0)

    narrative = _generate_narrative(side, p, payout_multiple, signals)

    return ScoredBet(
        ticker=str(market.get("ticker") or ""),
        event_ticker=str(market.get("event_ticker") or ""),
        title=str(market.get("title") or market.get("ticker") or "Untitled market"),
        side=side,
        price_cents=int(ask_cents),
        implied_probability=p,
        payout_multiple=payout_multiple,
        volume=int(volume),
        volume_24h=vol24,
        open_interest=int(market.get("open_interest") or 0),
        close_time=market.get("close_time"),
        category=market.get("category"),
        score=score,
        signals=signals,
        narrative=narrative,
        mode=mode,
    )


# ----------------------------------------------------------- public entry

def score_markets(
    markets: Iterable[dict],
    *,
    top: int = 3,
    min_volume: int = 0,
    max_per_event: int = 1,
    max_per_category: int = 0,
    mode: str = "best",
) -> list[ScoredBet]:
    """Score every tradable side of every market and return the top picks.

    Parameters
    ----------
    top : int
        How many bets to return.
    min_volume : int
        Skip markets with volume below this threshold.
    max_per_event : int
        Cap picks from a single event ticker (prevents e.g. five teams from
        the same championship flooding the list).
    max_per_category : int
        Cap picks per category.  0 = no cap.  In "best" mode defaults to 1
        so picks are spread across categories.
    mode : str
        One of ``best``, ``underdog``, ``momentum``, ``value``, ``safe``.
    """
    if mode not in MODES:
        raise ValueError(f"Unknown mode {mode!r}, choose from {MODES}")

    if mode == "best" and max_per_category == 0:
        max_per_category = 1

    candidates: list[ScoredBet] = []
    for market in markets:
        if (market.get("volume") or 0) < min_volume:
            continue
        yes_ask = market.get("yes_ask")
        no_ask = market.get("no_ask")
        if isinstance(yes_ask, (int, float)):
            bet = _score_side(market, "YES", float(yes_ask), mode)
            if bet is not None:
                candidates.append(bet)
        if isinstance(no_ask, (int, float)):
            bet = _score_side(market, "NO", float(no_ask), mode)
            if bet is not None:
                candidates.append(bet)

    candidates.sort(key=lambda b: b.score, reverse=True)

    picked: list[ScoredBet] = []
    per_event: dict[str, int] = {}
    per_market: dict[str, int] = {}
    per_category: dict[str, int] = {}
    for bet in candidates:
        event_key = bet.event_ticker or bet.ticker
        if per_event.get(event_key, 0) >= max_per_event:
            continue
        if per_market.get(bet.ticker, 0) >= 1:
            continue
        cat_key = (bet.category or "Other").lower()
        if max_per_category > 0 and per_category.get(cat_key, 0) >= max_per_category:
            continue
        picked.append(bet)
        per_event[event_key] = per_event.get(event_key, 0) + 1
        per_market[bet.ticker] = 1
        per_category[cat_key] = per_category.get(cat_key, 0) + 1
        if len(picked) >= top:
            break
    return picked
