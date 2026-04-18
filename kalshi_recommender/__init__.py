"""Kalshi bet recommender.

A small library + CLI that pulls live market data from Kalshi, scores each
side of every open binary market by an "upside relative to likelihood"
heuristic, and prints the top picks with hypothetical instructions for how to
place each bet.
"""

from .kalshi_client import KalshiClient, KalshiError
from .scoring import MODES, ScoredBet, score_markets
from .formatter import format_recommendations

__all__ = [
    "KalshiClient",
    "KalshiError",
    "ScoredBet",
    "score_markets",
    "format_recommendations",
]

__version__ = "0.1.0"
