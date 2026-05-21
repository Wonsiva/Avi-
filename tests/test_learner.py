"""Tests for the adaptive learning engine."""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

from kalshi_recommender.scoring import ScoredBet
from kalshi_recommender.tracker import check_outcomes, record_picks
from kalshi_recommender.learner import (
    analyze_signals,
    format_performance_report,
    get_adaptive_weights,
    update_weights,
)


def _make_bet(**overrides) -> ScoredBet:
    base = dict(
        ticker="TEST", event_ticker="EVT", title="Test",
        side="YES", price_cents=30, implied_probability=0.30,
        payout_multiple=2.33, volume=5000, volume_24h=2000,
        open_interest=1500, close_time="2026-06-01T00:00:00Z",
        category="Test", score=0.7,
        signals={"value": 0.6, "momentum": 0.3, "underdog": 0.4,
                 "activity": 0.5, "spread": 0.8, "longshot_edge": 0.1,
                 "volume_spike": 0.3},
        narrative="Test.", mode="best",
    )
    base.update(overrides)
    return ScoredBet(**base)


def _seed_history(data_dir: str, n: int = 15) -> None:
    """Create n picks and resolve them with alternating outcomes."""
    bets = [
        _make_bet(ticker=f"T-{i}", side="YES", price_cents=25 + i)
        for i in range(n)
    ]
    record_picks(bets, data_dir=data_dir)
    resolved = [
        {"ticker": f"T-{i}", "result": "yes" if i % 3 != 0 else "no"}
        for i in range(n)
    ]
    check_outcomes(resolved, data_dir=data_dir)


def test_analyze_signals_produces_stats():
    with tempfile.TemporaryDirectory() as d:
        _seed_history(d)
        stats = analyze_signals(data_dir=d)
        assert "value" in stats
        assert "win_rate" in stats["value"]
        assert 0 <= stats["value"]["win_rate"] <= 1


def test_update_weights_returns_none_with_too_few_picks():
    with tempfile.TemporaryDirectory() as d:
        bets = [_make_bet(ticker=f"T-{i}") for i in range(3)]
        record_picks(bets, data_dir=d)
        check_outcomes(
            [{"ticker": f"T-{i}", "result": "yes"} for i in range(3)],
            data_dir=d,
        )
        result = update_weights(data_dir=d)
        assert result is None


def test_update_weights_produces_valid_weights():
    with tempfile.TemporaryDirectory() as d:
        _seed_history(d)
        result = update_weights(data_dir=d)
        assert result is not None
        assert "best" in result
        best = result["best"]
        assert abs(sum(best.values()) - 1.0) < 0.01


def test_get_adaptive_weights_roundtrip():
    with tempfile.TemporaryDirectory() as d:
        _seed_history(d)
        update_weights(data_dir=d)
        loaded = get_adaptive_weights(data_dir=d)
        assert loaded is not None
        assert "best" in loaded


def test_format_performance_report():
    with tempfile.TemporaryDirectory() as d:
        _seed_history(d)
        update_weights(data_dir=d)
        report = format_performance_report(data_dir=d)
        assert "PERFORMANCE REPORT" in report
        assert "Win Rate" in report
        assert "Signal Performance" in report


def test_demo_history_loads_and_learns():
    """End-to-end: load sample history, run learning, check report."""
    import importlib.resources as resources
    with tempfile.TemporaryDirectory() as d:
        text = resources.files("kalshi_recommender.data").joinpath(
            "sample_history.json"
        ).read_text(encoding="utf-8")
        path = Path(d) / "picks_history.json"
        path.write_text(text, encoding="utf-8")

        result = update_weights(data_dir=d)
        assert result is not None
        report = format_performance_report(data_dir=d)
        assert "70" in report  # ~70% win rate from our sample data
