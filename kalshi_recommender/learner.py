"""Adaptive learning engine — analyzes signal performance and tunes weights.

The learner examines the history of recorded picks and their outcomes to
compute per-signal accuracy stats. It then adjusts the scoring weights
using an exponential moving average (EMA) so signals that have been
*actually predicting winners* get more weight over time.

The adaptive weights are stored in ``adaptive_weights.json`` and, when
present, override the static defaults in ``scoring.py``.

Learning loop:
    1. ``analyze_signals()``  — compute per-signal win rates from history
    2. ``update_weights()``   — EMA-blend signal performance into weights
    3. ``get_adaptive_weights()`` — read the current learned weights

The whole loop runs after ``tracker.check_outcomes()`` so it only learns
from resolved markets, not pending bets.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

from .tracker import DEFAULT_DATA_DIR, get_history

WEIGHTS_FILE = "adaptive_weights.json"
SIGNAL_STATS_FILE = "signal_performance.json"

SIGNAL_NAMES = ("value", "momentum", "underdog", "activity", "spread", "longshot_edge", "volume_spike")

# Learning rate for the EMA weight update. Higher = faster adaptation
# but noisier; lower = more stable but slower to react.
LEARNING_RATE = 0.15

# Minimum number of resolved picks before we start adapting weights.
MIN_PICKS_TO_LEARN = 10


def _data_path(data_dir: str | None = None) -> Path:
    d = Path(data_dir or DEFAULT_DATA_DIR)
    d.mkdir(parents=True, exist_ok=True)
    return d


def analyze_signals(*, data_dir: str | None = None) -> dict[str, dict]:
    """Compute per-signal performance stats from resolved pick history.

    For each signal, we compute:
    - ``total``: how many resolved picks had this signal > 0
    - ``correct``: how many of those were wins
    - ``win_rate``: correct / total
    - ``avg_when_correct``: average signal value on winning picks
    - ``avg_when_wrong``: average signal value on losing picks
    - ``edge``: avg_when_correct - avg_when_wrong (positive = predictive)
    """
    resolved = get_history(data_dir=data_dir, resolved_only=True)
    stats: dict[str, dict] = {}

    for signal in SIGNAL_NAMES:
        correct = 0
        total = 0
        sum_correct = 0.0
        sum_wrong = 0.0
        n_correct = 0
        n_wrong = 0

        for pick in resolved:
            signals = pick.get("signals_at_pick") or {}
            val = signals.get(signal, 0)
            if val <= 0:
                continue
            total += 1
            if pick["resolution"] == "win":
                correct += 1
                sum_correct += val
                n_correct += 1
            else:
                sum_wrong += val
                n_wrong += 1

        avg_correct = sum_correct / max(1, n_correct)
        avg_wrong = sum_wrong / max(1, n_wrong)
        win_rate = correct / max(1, total)

        stats[signal] = {
            "total": total,
            "correct": correct,
            "win_rate": round(win_rate, 4),
            "avg_when_correct": round(avg_correct, 4),
            "avg_when_wrong": round(avg_wrong, 4),
            "edge": round(avg_correct - avg_wrong, 4),
        }

    path = _data_path(data_dir) / SIGNAL_STATS_FILE
    path.write_text(json.dumps(stats, indent=2), encoding="utf-8")
    return stats


def update_weights(
    *,
    data_dir: str | None = None,
    base_weights: dict[str, dict[str, float]] | None = None,
) -> dict[str, dict[str, float]] | None:
    """Update adaptive weights based on signal performance.

    Uses an EMA blend: for each signal, the new weight is a blend of the
    old weight and the signal's empirical win_rate × edge. Then weights
    are normalized to sum to 1.

    Returns the updated weight dict, or None if there aren't enough
    resolved picks to learn from.
    """
    from .scoring import MODE_WEIGHTS

    resolved = get_history(data_dir=data_dir, resolved_only=True)
    if len(resolved) < MIN_PICKS_TO_LEARN:
        return None

    stats = analyze_signals(data_dir=data_dir)
    base = base_weights or MODE_WEIGHTS

    # Load existing adaptive weights if available.
    path = _data_path(data_dir) / WEIGHTS_FILE
    if path.exists():
        current = json.loads(path.read_text(encoding="utf-8"))
        adaptive = current.get("weights", base)
    else:
        adaptive = {mode: dict(w) for mode, w in base.items()}

    # Compute a "signal quality" score for each signal from the stats.
    quality: dict[str, float] = {}
    for signal in SIGNAL_NAMES:
        s = stats.get(signal, {})
        wr = s.get("win_rate", 0.5)
        edge = max(0, s.get("edge", 0))
        quality[signal] = wr * (1.0 + edge)

    # EMA-update each mode's weights.
    for mode in adaptive:
        old_weights = adaptive[mode]
        new_weights = {}
        for signal in SIGNAL_NAMES:
            if signal not in old_weights:
                continue
            target = quality.get(signal, 0.5)
            old_w = old_weights[signal]
            new_w = (1 - LEARNING_RATE) * old_w + LEARNING_RATE * target
            new_weights[signal] = max(0.01, new_w)

        # Normalize to sum to 1.
        total = sum(new_weights.values())
        if total > 0:
            for k in new_weights:
                new_weights[k] = round(new_weights[k] / total, 4)
        adaptive[mode] = new_weights

    payload = {
        "weights": adaptive,
        "signal_quality": {k: round(v, 4) for k, v in quality.items()},
        "picks_evaluated": len(resolved),
        "learning_rate": LEARNING_RATE,
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return adaptive


def get_adaptive_weights(
    *, data_dir: str | None = None
) -> dict[str, dict[str, float]] | None:
    """Load previously computed adaptive weights, or None if not yet learned."""
    path = _data_path(data_dir) / WEIGHTS_FILE
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    return data.get("weights")


def format_performance_report(*, data_dir: str | None = None) -> str:
    """Render a human-readable performance report."""
    from .tracker import get_summary_stats

    summary = get_summary_stats(data_dir=data_dir)
    stats = analyze_signals(data_dir=data_dir)

    lines: list[str] = []
    lines.append("KALSHI RECOMMENDER — PERFORMANCE REPORT")
    lines.append("=" * 56)
    lines.append("")

    # Overall stats
    lines.append("Overall Performance")
    lines.append("-" * 56)
    lines.append(f"  Total picks tracked:  {summary['total_picks']}")
    lines.append(f"  Resolved:             {summary['resolved']}")
    lines.append(f"  Pending:              {summary['pending']}")
    lines.append(
        f"  Wins / Losses:        {summary['wins']} / {summary['losses']} "
        f"({summary['win_rate']:.1%} win rate)"
    )
    lines.append(f"  Total profit:         {summary['total_profit_cents']:+d}¢")
    lines.append(f"  Total risked:         {summary['total_risked_cents']}¢")
    lines.append(f"  ROI:                  {summary['roi']:+.1%}")
    lines.append(f"  Avg win:              {summary['avg_win_cents']:+.0f}¢")
    lines.append(f"  Avg loss:             {summary['avg_loss_cents']:+.0f}¢")
    lines.append("")

    # Per-signal breakdown
    lines.append("Signal Performance")
    lines.append("-" * 56)
    lines.append(
        f"  {'Signal':<12} {'Win Rate':>9} {'Edge':>7} "
        f"{'Correct':>8} {'Total':>6}"
    )
    lines.append(f"  {'─' * 12} {'─' * 9} {'─' * 7} {'─' * 8} {'─' * 6}")
    for signal in SIGNAL_NAMES:
        s = stats.get(signal, {})
        wr = s.get("win_rate", 0)
        edge = s.get("edge", 0)
        correct = s.get("correct", 0)
        total = s.get("total", 0)
        marker = " ★" if edge > 0.05 else ""
        lines.append(
            f"  {signal:<12} {wr:>8.1%} {edge:>+6.3f} "
            f"{correct:>8} {total:>6}{marker}"
        )
    lines.append("")
    lines.append("  ★ = signal showing predictive edge")

    # Adaptive weights
    adaptive = get_adaptive_weights(data_dir=data_dir)
    if adaptive and "best" in adaptive:
        lines.append("")
        lines.append("Learned Weights (best mode)")
        lines.append("-" * 56)
        from .scoring import MODE_WEIGHTS

        default_best = MODE_WEIGHTS["best"]
        learned_best = adaptive["best"]
        for signal in SIGNAL_NAMES:
            dw = default_best.get(signal, 0)
            lw = learned_best.get(signal, 0)
            delta = lw - dw
            arrow = "↑" if delta > 0.01 else "↓" if delta < -0.01 else "→"
            lines.append(
                f"  {signal:<12} default {dw:.2f} → learned {lw:.2f}  {arrow}"
            )

    lines.append("")
    return "\n".join(lines)
