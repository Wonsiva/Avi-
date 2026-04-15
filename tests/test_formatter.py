"""Unit tests for the formatter."""

from __future__ import annotations

from kalshi_recommender.formatter import DISCLAIMER, format_recommendations
from kalshi_recommender.scoring import ScoredBet


def make_bet(**overrides) -> ScoredBet:
    base = dict(
        ticker="TEST-TICKER",
        event_ticker="TEST-EVENT",
        title="A test market",
        side="YES",
        price_cents=25,
        implied_probability=0.25,
        payout_multiple=3.0,
        volume=1234,
        open_interest=500,
        close_time="2026-06-01T00:00:00Z",
        category="Test",
        score=0.5,
        components={"interestingness": 0.6, "liquidity": 0.8, "urgency": 1.0},
    )
    base.update(overrides)
    return ScoredBet(**base)


def test_format_includes_each_bet_and_disclaimer():
    bets = [make_bet(ticker="A"), make_bet(ticker="B"), make_bet(ticker="C")]
    out = format_recommendations(bets, stake_dollars=10)
    assert "Top 3 most interesting Kalshi bets" in out
    assert "#1  A" in out
    assert "#2  B" in out
    assert "#3  C" in out
    assert DISCLAIMER in out


def test_format_handles_empty_list():
    out = format_recommendations([], stake_dollars=10)
    assert "No tradable Kalshi markets" in out
    assert DISCLAIMER in out


def test_format_includes_clear_action_steps():
    bet = make_bet(side="YES", price_cents=20)
    out = format_recommendations([bet], stake_dollars=10)
    assert "Sign in to Kalshi" in out
    assert "BUY YES at 20" in out
    # 1000 cents / 20 cents = 50 contracts
    assert "50 contracts at 20" in out
    # On a $10 stake -> $50 payout if win -> $40 profit -> 4x.
    assert "$50.00" in out
    assert "$40.00" in out


def test_format_describes_loss_scenario():
    bet = make_bet(side="NO", price_cents=40)
    out = format_recommendations([bet], stake_dollars=20)
    # Buying NO; if it resolves YES the contracts expire worthless.
    assert "BUY NO at 40" in out
    assert "resolves YES" in out


def test_format_uses_market_url():
    bet = make_bet(ticker="FEDRATE-25DEC-T4.25", event_ticker="FEDRATE-25DEC")
    out = format_recommendations([bet], stake_dollars=5)
    assert "https://kalshi.com/markets/fedrate-25dec/fedrate-25dec-t4.25" in out
