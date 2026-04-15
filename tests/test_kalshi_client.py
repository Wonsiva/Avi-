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


def test_filter_tradable_drops_closed_and_extreme():
    markets = [
        {"ticker": "OK", "status": "open", "yes_ask": 30, "no_ask": 71},
        {"ticker": "ACTIVE", "status": "active", "yes_ask": 25, "no_ask": 76},
        {"ticker": "CLOSED", "status": "closed", "yes_ask": 30, "no_ask": 71},
        {"ticker": "EXTREME-LOW", "status": "open", "yes_ask": 1, "no_ask": 99},
        {"ticker": "EXTREME-HIGH", "status": "open", "yes_ask": 99, "no_ask": 1},
        {"ticker": "MISSING", "status": "open"},
    ]
    out = filter_tradable(markets)
    tickers = {m["ticker"] for m in out}
    assert tickers == {"OK", "ACTIVE"}


def test_filter_tradable_handles_non_numeric_prices():
    markets = [
        {"ticker": "BAD", "status": "open", "yes_ask": "thirty", "no_ask": 71},
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
