"""Unit tests for the multi-signal scoring module."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from kalshi_recommender.scoring import (
    MODES,
    ScoredBet,
    _activity_signal,
    _liquidity_factor,
    _momentum_signal,
    _spread_signal,
    _underdog_signal,
    _urgency_factor,
    _value_signal,
    score_markets,
)


def make_market(**overrides):
    base = {
        "ticker": "TEST-MARKET",
        "event_ticker": "TEST-EVENT",
        "title": "A test market",
        "category": "Test",
        "status": "open",
        "yes_ask": 30, "yes_bid": 28,
        "no_ask": 71, "no_bid": 69,
        "last_price": 30, "previous_price": 25,
        "volume": 5000, "volume_24h": 2000,
        "open_interest": 1500,
        "close_time": "2026-06-01T00:00:00Z",
    }
    base.update(overrides)
    return base


# ------------------------------ value signal --------------------------------

def test_value_signal_zero_at_extremes():
    assert _value_signal(0.0) == 0.0
    assert _value_signal(1.0) == 0.0


def test_value_signal_peaks_in_sweet_spot():
    peak = _value_signal(0.286)
    assert peak > _value_signal(0.05)
    assert peak > _value_signal(0.5)
    assert peak > _value_signal(0.85)


@pytest.mark.parametrize("p", [0.05, 0.15, 0.30, 0.50, 0.80])
def test_value_signal_is_finite_and_positive(p):
    score = _value_signal(p)
    assert 0 < score < 1


# ------------------------------ momentum ------------------------------------

def test_momentum_positive_for_rising_yes():
    m = make_market(last_price=30, previous_price=25)
    assert _momentum_signal(m, "YES") > 0


def test_momentum_negative_for_falling_yes():
    m = make_market(last_price=20, previous_price=30)
    assert _momentum_signal(m, "YES") < 0


def test_momentum_inverted_for_no_side():
    m = make_market(last_price=30, previous_price=25)
    assert _momentum_signal(m, "NO") < 0


def test_momentum_zero_when_no_data():
    m = make_market()
    del m["previous_price"]
    assert _momentum_signal(m, "YES") == 0.0


# ------------------------------ underdog ------------------------------------

def test_underdog_signal_zero_for_favorites():
    m = make_market(volume=10000)
    assert _underdog_signal(m, 0.50) == 0.0
    assert _underdog_signal(m, 0.70) == 0.0


def test_underdog_signal_positive_for_longshots_with_volume():
    m = make_market(volume=10000)
    assert _underdog_signal(m, 0.15) > 0
    assert _underdog_signal(m, 0.10) > _underdog_signal(m, 0.30)


def test_underdog_signal_zero_for_no_volume():
    m = make_market(volume=0, volume_24h=0)
    assert _underdog_signal(m, 0.15) == 0.0


# ------------------------------ activity ------------------------------------

def test_activity_signal_high_when_hot():
    m = make_market(volume_24h=5000, open_interest=1000)
    assert _activity_signal(m) > 0.5


def test_activity_signal_low_when_quiet():
    m = make_market(volume_24h=10, open_interest=10000)
    assert _activity_signal(m) < 0.05


# ------------------------------ spread --------------------------------------

def test_spread_tight_gives_high_signal():
    m = make_market(yes_ask=30, yes_bid=29)
    assert _spread_signal(m, "YES") > 0.9


def test_spread_wide_gives_low_signal():
    m = make_market(yes_ask=30, yes_bid=15)
    assert _spread_signal(m, "YES") < 0.5


# ------------------------------ liquidity -----------------------------------

def test_liquidity_factor_monotonic_in_volume():
    a = _liquidity_factor(50)
    b = _liquidity_factor(500)
    c = _liquidity_factor(5000)
    d = _liquidity_factor(50_000)
    assert a < b < c <= d


def test_liquidity_factor_handles_zero_and_negative():
    assert _liquidity_factor(0) > 0
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
    markets = [
        make_market(
            ticker=f"T{i}",
            event_ticker=f"EVT-{i}",
            category=f"Cat-{i}",
            yes_ask=20 + i,
            no_ask=81 - i,
        )
        for i in range(8)
    ]
    bets = score_markets(markets, top=3)
    assert len(bets) == 3
    assert all(isinstance(b, ScoredBet) for b in bets)
    assert bets[0].score >= bets[1].score >= bets[2].score


def test_score_markets_skips_extreme_prices():
    markets = [
        make_market(ticker="WAY-LOW", event_ticker="E1", category="A", yes_ask=1, no_ask=99),
        make_market(ticker="WAY-HIGH", event_ticker="E2", category="B", yes_ask=99, no_ask=1),
        make_market(ticker="GOOD", event_ticker="E3", category="C", yes_ask=30, no_ask=71),
    ]
    bets = score_markets(markets, top=5)
    tickers = {b.ticker for b in bets}
    assert "GOOD" in tickers
    assert "WAY-LOW" not in tickers
    assert "WAY-HIGH" not in tickers


def test_score_markets_respects_min_volume():
    quiet = make_market(ticker="QUIET", event_ticker="E1", category="A", volume=10)
    busy = make_market(ticker="BUSY", event_ticker="E2", category="B", volume=10_000)
    bets = score_markets([quiet, busy], top=5, min_volume=1000)
    assert {b.ticker for b in bets} == {"BUSY"}


def test_score_markets_caps_per_event():
    markets = [
        make_market(
            ticker=f"NBA-CHAMP-25-{i}",
            event_ticker="NBA-CHAMP-25",
            category="Sports",
            yes_ask=20 + i,
            no_ask=81 - i,
        )
        for i in range(5)
    ]
    bets = score_markets(markets, top=5, max_per_event=1, max_per_category=5)
    assert len(bets) == 1
    assert bets[0].event_ticker == "NBA-CHAMP-25"


def test_score_markets_category_diversity_in_best_mode():
    markets = [
        make_market(
            ticker=f"T{i}",
            event_ticker=f"EVT-{i}",
            category="SameCategory",
            yes_ask=25 + i,
            no_ask=76 - i,
        )
        for i in range(5)
    ]
    bets = score_markets(markets, top=3, mode="best")
    # In best mode, max_per_category defaults to 1
    assert len(bets) == 1


def test_score_markets_does_not_recommend_both_sides_of_one_market():
    markets = [make_market(ticker="ONLY", event_ticker="E1", category="A", yes_ask=30, no_ask=71)]
    bets = score_markets(markets, top=5, max_per_event=2, max_per_category=5)
    assert len(bets) == 1


def test_scored_bet_payout_math():
    market = make_market(yes_ask=25, no_ask=76, event_ticker="E1", category="A")
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


def test_scored_bet_has_narrative():
    market = make_market(event_ticker="E1", category="A")
    bets = score_markets([market], top=1)
    assert len(bets) == 1
    assert len(bets[0].narrative) > 0


def test_scored_bet_has_signals():
    market = make_market(event_ticker="E1", category="A")
    bets = score_markets([market], top=1)
    assert len(bets) == 1
    for key in ("value", "momentum", "underdog", "activity", "spread"):
        assert key in bets[0].signals


# ------------------------------ modes ----------------------------------------

def test_underdog_mode_filters_favorites():
    fav = make_market(ticker="FAV", event_ticker="E1", category="A", yes_ask=60, no_ask=41)
    longshot = make_market(ticker="LONG", event_ticker="E2", category="B", yes_ask=15, no_ask=86, volume=8000)
    bets = score_markets([fav, longshot], top=5, mode="underdog", max_per_category=5)
    tickers = {b.ticker for b in bets}
    assert "LONG" in tickers
    # FAV at 60% should be filtered out in underdog mode
    sides_from_fav = [b for b in bets if b.ticker == "FAV" and b.side == "YES"]
    assert len(sides_from_fav) == 0


def test_safe_mode_filters_longshots():
    longshot = make_market(ticker="LONG", event_ticker="E1", category="A", yes_ask=15, no_ask=86)
    safe_bet = make_market(ticker="SAFE", event_ticker="E2", category="B", yes_ask=65, no_ask=36)
    bets = score_markets([longshot, safe_bet], top=5, mode="safe", max_per_category=5)
    tickers = {b.ticker for b in bets}
    assert "SAFE" in tickers


def test_all_modes_are_valid():
    market = make_market(event_ticker="E1", category="A")
    for mode in MODES:
        bets = score_markets([market], top=1, mode=mode)
        # Some modes may filter this market out, but the call should not error
        assert isinstance(bets, list)


def test_invalid_mode_raises():
    with pytest.raises(ValueError, match="Unknown mode"):
        score_markets([], mode="nonexistent")
