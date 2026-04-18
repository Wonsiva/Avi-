"""Unit tests for the formatter."""

from __future__ import annotations

import json

from kalshi_recommender.formatter import (
    DISCLAIMER,
    format_recommendations,
    format_recommendations_html,
    format_recommendations_json,
    format_recommendations_markdown,
)
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
        volume_24h=500,
        open_interest=500,
        close_time="2026-06-01T00:00:00Z",
        category="Test",
        score=0.5,
        signals={"value": 0.6, "underdog": 0.3, "momentum": 0.2, "activity": 0.4, "spread": 0.8},
        narrative="Strong risk-reward sweet spot at 3.0x payout with 25% chance of winning.",
        mode="best",
    )
    base.update(overrides)
    return ScoredBet(**base)


# ----------------------------- text formatter --------------------------------

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


def test_format_includes_narrative():
    bet = make_bet(narrative="This is an overlooked underdog play.")
    out = format_recommendations([bet], stake_dollars=10)
    assert "This is an overlooked underdog play." in out


def test_format_includes_clear_action_steps():
    bet = make_bet(side="YES", price_cents=20)
    out = format_recommendations([bet], stake_dollars=10)
    assert "Sign in to Kalshi" in out
    assert "BUY YES at 20" in out
    assert "50 contracts at 20" in out
    assert "$50.00" in out
    assert "$40.00" in out


def test_format_describes_loss_scenario():
    bet = make_bet(side="NO", price_cents=40)
    out = format_recommendations([bet], stake_dollars=20)
    assert "BUY NO at 40" in out
    assert "resolves YES" in out


def test_format_uses_market_url():
    bet = make_bet(ticker="FEDRATE-25DEC-T4.25", event_ticker="FEDRATE-25DEC")
    out = format_recommendations([bet], stake_dollars=5)
    assert "https://kalshi.com/markets/fedrate-25dec/fedrate-25dec-t4.25" in out


# ----------------------------- HTML formatter --------------------------------

def test_html_is_self_contained_and_renders_each_bet():
    bets = [make_bet(ticker="A"), make_bet(ticker="B")]
    out = format_recommendations_html(bets, stake_dollars=10)
    assert out.startswith("<!doctype html>")
    assert "<style>" in out
    assert "BUY YES" in out
    assert ">A<" in out and ">B<" in out
    assert DISCLAIMER in out


def test_html_handles_empty_list():
    out = format_recommendations_html([], stake_dollars=10)
    assert "No tradable Kalshi markets" in out
    assert DISCLAIMER in out


def test_html_escapes_user_visible_strings():
    bet = make_bet(title="Will <script>alert('xss')</script> happen?")
    out = format_recommendations_html([bet], stake_dollars=10)
    assert "<script>alert" not in out
    assert "&lt;script&gt;alert" in out


def test_html_includes_narrative():
    bet = make_bet(narrative="Overlooked underdog play.")
    out = format_recommendations_html([bet], stake_dollars=10)
    assert "Overlooked underdog play." in out
    assert "narrative" in out  # CSS class


def test_html_includes_market_url():
    bet = make_bet(ticker="FEDRATE-25DEC-T4.25", event_ticker="FEDRATE-25DEC")
    out = format_recommendations_html([bet], stake_dollars=5)
    assert "https://kalshi.com/markets/fedrate-25dec/fedrate-25dec-t4.25" in out


# ----------------------------- JSON formatter --------------------------------

def test_json_output_is_valid_and_structured():
    bets = [make_bet(ticker="A"), make_bet(ticker="B", side="NO", price_cents=70)]
    raw = format_recommendations_json(bets, stake_dollars=10, header="hi")
    payload = json.loads(raw)
    assert payload["header"] == "hi"
    assert payload["stake_dollars"] == 10
    assert payload["disclaimer"] == DISCLAIMER
    assert len(payload["recommendations"]) == 2
    first = payload["recommendations"][0]
    for key in (
        "rank", "ticker", "side", "price_cents",
        "implied_probability", "payout_multiple",
        "market_url", "plan", "signals", "narrative", "mode",
    ):
        assert key in first, f"missing key: {key}"
    assert first["plan"]["contracts"] >= 1
    assert first["plan"]["cost_dollars"] > 0


def test_json_empty_recommendations():
    raw = format_recommendations_json([], stake_dollars=10)
    payload = json.loads(raw)
    assert payload["recommendations"] == []
    assert payload["disclaimer"] == DISCLAIMER


# ----------------------------- Markdown formatter ----------------------------

def test_markdown_includes_narrative():
    bet = make_bet(narrative="Overlooked underdog play.")
    out = format_recommendations_markdown([bet], stake_dollars=10)
    assert "Overlooked underdog play." in out


def test_markdown_includes_action_steps():
    bet = make_bet(side="YES", price_cents=25)
    out = format_recommendations_markdown([bet], stake_dollars=10)
    assert "Sign in to Kalshi" in out
    assert "BUY **YES**" in out


def test_markdown_handles_empty_list():
    out = format_recommendations_markdown([], stake_dollars=10)
    assert "No tradable Kalshi markets" in out
    assert DISCLAIMER in out
