"""Pick tracker — records recommendations and checks outcomes.

Every time the recommender produces picks, the tracker can log them with
their signal values. When markets resolve, the tracker checks outcomes
and records win/loss results. This history feeds the learner module.

Storage is a single JSON file (``picks_history.json``) so it works
without a database. The file lives in a configurable data directory
(defaults to ``~/.kalshi-recommender/``).
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from .scoring import ScoredBet

DEFAULT_DATA_DIR = os.path.expanduser("~/.kalshi-recommender")
HISTORY_FILE = "picks_history.json"


def _data_path(data_dir: str | None = None) -> Path:
    d = Path(data_dir or DEFAULT_DATA_DIR)
    d.mkdir(parents=True, exist_ok=True)
    return d


def _load_history(data_dir: str | None = None) -> list[dict]:
    path = _data_path(data_dir) / HISTORY_FILE
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def _save_history(records: list[dict], data_dir: str | None = None) -> Path:
    path = _data_path(data_dir) / HISTORY_FILE
    path.write_text(json.dumps(records, indent=2), encoding="utf-8")
    return path


def record_picks(
    bets: Iterable[ScoredBet],
    *,
    data_dir: str | None = None,
) -> list[dict]:
    """Append new picks to the history file and return the new records."""
    history = _load_history(data_dir)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    new_records = []
    for bet in bets:
        record = {
            "pick_id": str(uuid.uuid4())[:8],
            "timestamp": now,
            "ticker": bet.ticker,
            "event_ticker": bet.event_ticker,
            "title": bet.title,
            "side": bet.side,
            "price_at_pick": bet.price_cents,
            "implied_probability": round(bet.implied_probability, 4),
            "payout_multiple": round(bet.payout_multiple, 4),
            "signals_at_pick": {k: round(v, 4) for k, v in bet.signals.items()},
            "mode": bet.mode,
            "score_at_pick": round(bet.score, 4),
            "category": bet.category,
            "close_time": bet.close_time,
            "resolution": None,
            "resolution_time": None,
            "profit_loss_cents": None,
        }
        new_records.append(record)
    history.extend(new_records)
    _save_history(history, data_dir)
    return new_records


def check_outcomes(
    resolved_markets: Iterable[dict],
    *,
    data_dir: str | None = None,
) -> list[dict]:
    """Match resolved markets against unresolved picks and update outcomes.

    ``resolved_markets`` should be an iterable of dicts with at least
    ``ticker`` and ``result`` (``"yes"`` or ``"no"``).

    Returns the list of picks that were updated in this call.
    """
    history = _load_history(data_dir)
    resolved_map: dict[str, str] = {}
    for m in resolved_markets:
        ticker = m.get("ticker", "")
        result = (m.get("result") or "").lower()
        if ticker and result in ("yes", "no"):
            resolved_map[ticker] = result

    updated = []
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    for record in history:
        if record["resolution"] is not None:
            continue
        ticker = record["ticker"]
        if ticker not in resolved_map:
            continue
        result = resolved_map[ticker]
        side = record["side"].lower()
        won = result == side
        record["resolution"] = "win" if won else "loss"
        record["resolution_time"] = now
        price = record["price_at_pick"]
        record["profit_loss_cents"] = (100 - price) if won else -price
        updated.append(record)

    if updated:
        _save_history(history, data_dir)
    return updated


def get_history(
    *,
    data_dir: str | None = None,
    resolved_only: bool = False,
) -> list[dict]:
    """Return the full pick history, optionally filtered to resolved picks."""
    history = _load_history(data_dir)
    if resolved_only:
        return [r for r in history if r["resolution"] is not None]
    return history


def get_summary_stats(*, data_dir: str | None = None) -> dict:
    """Compute aggregate performance statistics from the pick history."""
    history = _load_history(data_dir)
    total = len(history)
    resolved = [r for r in history if r["resolution"] is not None]
    wins = [r for r in resolved if r["resolution"] == "win"]
    losses = [r for r in resolved if r["resolution"] == "loss"]
    pending = total - len(resolved)

    total_profit = sum(r["profit_loss_cents"] or 0 for r in resolved)
    total_risked = sum(r["price_at_pick"] for r in resolved)

    return {
        "total_picks": total,
        "resolved": len(resolved),
        "pending": pending,
        "wins": len(wins),
        "losses": len(losses),
        "win_rate": len(wins) / max(1, len(resolved)),
        "total_profit_cents": total_profit,
        "total_risked_cents": total_risked,
        "roi": total_profit / max(1, total_risked),
        "avg_win_cents": (
            sum(r["profit_loss_cents"] for r in wins) / max(1, len(wins))
        ),
        "avg_loss_cents": (
            sum(r["profit_loss_cents"] for r in losses) / max(1, len(losses))
        ),
    }
