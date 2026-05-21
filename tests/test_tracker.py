"""Tests for the pick tracker."""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

from kalshi_recommender.scoring import ScoredBet
from kalshi_recommender.tracker import (
    check_outcomes,
    get_history,
    get_summary_stats,
    record_picks,
)


def _make_bet(**overrides) -> ScoredBet:
    base = dict(
        ticker="TEST-BET", event_ticker="TEST-EVT", title="Test",
        side="YES", price_cents=30, implied_probability=0.30,
        payout_multiple=2.33, volume=5000, volume_24h=2000,
        open_interest=1500, close_time="2026-06-01T00:00:00Z",
        category="Test", score=0.7,
        signals={"value": 0.6, "momentum": 0.3, "underdog": 0.4,
                 "activity": 0.5, "spread": 0.8, "longshot_edge": 0.1,
                 "volume_spike": 0.3},
        narrative="Test narrative.", mode="best",
    )
    base.update(overrides)
    return ScoredBet(**base)


def test_record_and_retrieve_picks():
    with tempfile.TemporaryDirectory() as d:
        bet = _make_bet(ticker="REC-1")
        records = record_picks([bet], data_dir=d)
        assert len(records) == 1
        assert records[0]["ticker"] == "REC-1"
        assert records[0]["resolution"] is None

        history = get_history(data_dir=d)
        assert len(history) == 1


def test_check_outcomes_marks_win_and_loss():
    with tempfile.TemporaryDirectory() as d:
        record_picks(
            [_make_bet(ticker="WIN-1", side="YES", price_cents=25),
             _make_bet(ticker="LOSS-1", side="YES", price_cents=40)],
            data_dir=d,
        )
        resolved = [
            {"ticker": "WIN-1", "result": "yes"},
            {"ticker": "LOSS-1", "result": "no"},
        ]
        updated = check_outcomes(resolved, data_dir=d)
        assert len(updated) == 2

        history = get_history(data_dir=d, resolved_only=True)
        by_ticker = {r["ticker"]: r for r in history}
        assert by_ticker["WIN-1"]["resolution"] == "win"
        assert by_ticker["WIN-1"]["profit_loss_cents"] == 75
        assert by_ticker["LOSS-1"]["resolution"] == "loss"
        assert by_ticker["LOSS-1"]["profit_loss_cents"] == -40


def test_summary_stats():
    with tempfile.TemporaryDirectory() as d:
        record_picks(
            [_make_bet(ticker="A", side="YES", price_cents=20),
             _make_bet(ticker="B", side="NO", price_cents=60)],
            data_dir=d,
        )
        check_outcomes(
            [{"ticker": "A", "result": "yes"},
             {"ticker": "B", "result": "yes"}],
            data_dir=d,
        )
        stats = get_summary_stats(data_dir=d)
        assert stats["total_picks"] == 2
        assert stats["wins"] == 1
        assert stats["losses"] == 1
        assert stats["resolved"] == 2
