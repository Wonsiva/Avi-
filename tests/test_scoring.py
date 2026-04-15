"""Unit tests for the scoring module."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from kalshi_recommender.scoring import (
    ALPHA,
    BETA,
    ScoredBet,
    _interestingness,
    _liquidity_factor,
    _urgency_factor,
    score_markets,
)


def make_market(**overrides):
    base = {
        "ticker": "TEST-MARKET",
        "event_ticker": "TEST-EVENT",
        "title": "A test market",
        "category": "Test",
        "status": "open",
        "yes_ask": 30,
        "no_ask": 71,
        "last_price": 30,
        "volume": 5000,
        "open_interest": 1500,
        "close_time": "2026-06-01T00:00:00Z",
    }
    base.update(overrides)
    return base


# -------------------------- interestingness curve ----------------------------

def test_interestingness_zero_at_extremes():
    assert _interestingness(0.0) == 0.0
    assert _interestingness(1.0) == 0.0


def test_interestingness_peaks_in_sweet_spot():
    # Peak of (1-p)^ALPHA * p^BETA is at p = BETA / (ALPHA + BETA).
    expected_peak = BETA / (ALPHA + BETA)
    assert 0.20 < expected_peak < 0.40
    peak = _interestingness(expected_peak)
    # Values noticeably below or above the peak should score lower.
    assert peak > _interestingness(0.05)
    assert peak > _interestingness(0.5)
    assert peak > _interestingness(0.85)


@pytest.mark.parametrize("p", [0.05, 0.15, 0.30, 0.50, 0.80])
def test_interestingness_is_finite_and_positive(p):
    score = _interestingness(p)
    assert score > 0
    assert score < 1


# ------------------------------ liquidity ------------------------------------

def test_liquidity_factor_monotonic_in_volume():
    a = _liquidity_factor(50)
    b = _liquidity_factor(500)
    c = _liquidity_factor(5000)
    d = _liquidity_factor(50_000)
    assert a < b < c <= d


def test_liquidity_factor_handles_zero_and_negative():
    assert _liquidity_factor(0) > 0  # tiny but non-zero floor
    assert _liquidity_factor(-1) > 0


def test_liquidity_factor_caps_at_one():
    assert _liquidity_factor(10**9) == 1.0


# ------------------------------ urgency --------------------------------------

def test_urgency_factor_far_future_is_unity():
    far = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
    assert _urgency_factor(far) == 1.0


def test_urgency_factor_near_term_gives_bonus():
    soon = (datetime.now(timezone.utc) + timedelta(hours=6)).isoformat()
    assert _urgency_factor(soon) > 1.0


def test_urgency_factor_handles_missing_or_malformed():
    assert _urgency_factor(None) == 1.0
    assert _urgency_factor("not-a-date") == 1.0


def test_urgency_factor_does_not_boost_past_close():
    past = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    assert _urgency_factor(past) == 1.0


# ------------------------------ ranking --------------------------------------

def test_score_markets_returns_top_n():
    # Distinct event_tickers so the per-event cap doesn't filter them out.
    markets = [
        make_market(
            ticker=f"T{i}",
            event_ticker=f"EVT-{i}",
            yes_ask=20 + i,
            no_ask=81 - i,
        )
        for i in range(8)
    ]
    bets = score_markets(markets, top=3)
    assert len(bets) == 3
    assert all(isinstance(b, ScoredBet) for b in bets)
    # Output is sorted descending by score.
    assert bets[0].score >= bets[1].score >= bets[2].score


def test_score_markets_skips_extreme_prices():
    markets = [
        make_market(ticker="WAY-LOW", yes_ask=1, no_ask=99),
        make_market(ticker="WAY-HIGH", yes_ask=99, no_ask=1),
        make_market(ticker="GOOD", yes_ask=30, no_ask=71),
    ]
    bets = score_markets(markets, top=5)
    tickers = {b.ticker for b in bets}
    assert "GOOD" in tickers
    assert "WAY-LOW" not in tickers
    assert "WAY-HIGH" not in tickers


def test_score_markets_respects_min_volume():
    quiet = make_market(ticker="QUIET", volume=10)
    busy = make_market(ticker="BUSY", volume=10_000)
    bets = score_markets([quiet, busy], top=5, min_volume=1000)
    assert {b.ticker for b in bets} == {"BUSY"}


def test_score_markets_caps_per_event():
    markets = [
        make_market(
            ticker=f"NBA-CHAMP-25-{i}",
            event_ticker="NBA-CHAMP-25",
            yes_ask=20 + i,
            no_ask=81 - i,
        )
        for i in range(5)
    ]
    bets = score_markets(markets, top=5, max_per_event=1)
    assert len(bets) == 1
    assert bets[0].event_ticker == "NBA-CHAMP-25"


def test_score_markets_does_not_recommend_both_sides_of_one_market():
    markets = [make_market(ticker="ONLY", yes_ask=30, no_ask=71)]
    bets = score_markets(markets, top=5, max_per_event=2)
    assert len(bets) == 1


def test_scored_bet_payout_math():
    market = make_market(yes_ask=25, no_ask=76)
    bets = score_markets([market], top=1)
    assert len(bets) == 1
    bet = bets[0]
    if bet.side == "YES":
        assert bet.price_cents == 25
        assert bet.profit_per_contract_cents == 75
        assert bet.payout_multiple == pytest.approx(75 / 25)
    else:
        assert bet.price_cents == 76
        assert bet.profit_per_contract_cents == 24
        assert bet.payout_multiple == pytest.approx(24 / 76)


def test_score_markets_ignores_markets_without_prices():
    markets = [
        {"ticker": "NO-PRICES", "status": "open", "volume": 100},
        make_market(ticker="OK", yes_ask=30, no_ask=71),
    ]
    bets = score_markets(markets, top=5)
    assert all(b.ticker == "OK" for b in bets)
