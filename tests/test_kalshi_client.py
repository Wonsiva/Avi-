"""Unit tests for the Kalshi client (offline portions only)."""

from __future__ import annotations

from kalshi_recommender.kalshi_client import KalshiClient, filter_tradable


def test_load_sample_returns_markets():
    markets = KalshiClient.load_sample()
    assert isinstance(markets, list)
    assert len(markets) > 0
    sample = markets[0]
    # Spot-check the shape we care about for downstream scoring.
    for key in ("ticker", "title", "yes_ask", "no_ask", "status"):
        assert key in sample, f"sample market missing {key}"


def test_filter_tradable_keeps_open_and_drops_closed():
    markets = [
        {"ticker": "OK", "status": "open", "yes_ask": 30, "no_ask": 71},
        {"ticker": "ACTIVE", "status": "active", "yes_ask": 25, "no_ask": 76},
        {"ticker": "INIT", "status": "initialized", "yes_ask": 40, "no_ask": 61},
        {"ticker": "CLOSED", "status": "closed", "yes_ask": 30, "no_ask": 71},
        {"ticker": "SETTLED", "status": "settled", "yes_ask": 30, "no_ask": 71},
    ]
    out = filter_tradable(markets)
    tickers = {m["ticker"] for m in out}
    assert tickers == {"OK", "ACTIVE", "INIT"}


def test_filter_tradable_drops_extremes_only_when_both_sides_bad():
    # Both sides at extremes → dropped.
    both_bad = {"ticker": "BOTH-BAD", "status": "open", "yes_ask": 1, "no_ask": 1}
    # One side in range → kept (we can still recommend that side).
    one_ok = {"ticker": "ONE-OK", "status": "open", "yes_ask": 1, "no_ask": 50}
    # No prices at all → dropped.
    missing = {"ticker": "MISSING", "status": "open"}
    out = filter_tradable([both_bad, one_ok, missing])
    assert [m["ticker"] for m in out] == ["ONE-OK"]


def test_filter_tradable_handles_non_numeric_prices():
    markets = [
        {"ticker": "BAD", "status": "open", "yes_ask": "thirty", "no_ask": "seventy"},
        {"ticker": "OK", "status": "open", "yes_ask": 30, "no_ask": 71},
    ]
    assert [m["ticker"] for m in filter_tradable(markets)] == ["OK"]


def test_sample_pipeline_end_to_end():
    """Loading sample markets and scoring them yields runnable recommendations."""
    from kalshi_recommender.scoring import score_markets
    from kalshi_recommender.formatter import format_recommendations

    markets = KalshiClient.load_sample()
    tradable = filter_tradable(markets)
    bets = score_markets(tradable, top=3)
    assert len(bets) == 3
    text = format_recommendations(bets, stake_dollars=10)
    assert "Top 3 most interesting Kalshi bets" in text
    # Each bet should appear in the rendered output.
    for bet in bets:
        assert bet.ticker in text
