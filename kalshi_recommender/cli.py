"""Command-line entry point for the Kalshi bet recommender."""

from __future__ import annotations

import argparse
import sys

from .formatter import (
    format_recommendations,
    format_recommendations_html,
    format_recommendations_json,
)
from .kalshi_client import (
    DEFAULT_BASE_URL,
    DEFAULT_TIMEOUT,
    FetchOptions,
    KalshiClient,
    KalshiError,
    filter_tradable,
)
from .scoring import score_markets

FORMATTERS = {
    "text": format_recommendations,
    "html": format_recommendations_html,
    "json": format_recommendations_json,
}


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="kalshi-recommender",
        description=(
            "Identify the most interesting open Kalshi bets, ranked by "
            "potential upside relative to the likelihood of winning, and "
            "print hypothetical instructions for placing each one."
        ),
    )
    parser.add_argument(
        "--top",
        type=int,
        default=3,
        help="number of bets to recommend (default: 3)",
    )
    parser.add_argument(
        "--min-volume",
        type=int,
        default=200,
        help=(
            "skip markets with less than this 24h trading volume "
            "(default: 200; lower means more obscure markets show up)"
        ),
    )
    parser.add_argument(
        "--stake",
        type=float,
        default=10.0,
        help="hypothetical dollar stake per bet for the instructions (default: $10)",
    )
    parser.add_argument(
        "--max-markets",
        type=int,
        default=1000,
        help="cap on how many markets to pull from the API (default: 1000)",
    )
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help="override the Kalshi API base URL",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=DEFAULT_TIMEOUT,
        help="HTTP timeout in seconds for Kalshi API calls",
    )
    parser.add_argument(
        "--sample",
        action="store_true",
        help=(
            "use bundled sample market data instead of calling the Kalshi "
            "API (handy for offline demos and CI)"
        ),
    )
    parser.add_argument(
        "--format",
        choices=sorted(FORMATTERS),
        default="text",
        help="output format: text (default), html, or json",
    )
    parser.add_argument(
        "--output",
        "-o",
        default=None,
        help="write output to this file instead of stdout",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    try:
        if args.sample:
            markets = KalshiClient.load_sample()
            source = "bundled sample data"
        else:
            client = KalshiClient(base_url=args.base_url, timeout=args.timeout)
            markets = client.fetch_markets(
                FetchOptions(max_markets=args.max_markets)
            )
            source = f"live Kalshi API ({args.base_url})"
    except KalshiError as exc:
        print(f"Error fetching markets: {exc}", file=sys.stderr)
        print(
            "Tip: pass --sample to run against bundled offline data.",
            file=sys.stderr,
        )
        return 2

    tradable = filter_tradable(markets)
    bets = score_markets(
        tradable, top=args.top, min_volume=args.min_volume
    )
    header = (
        f"Analyzed {len(tradable):,} tradable Kalshi markets from {source}."
    )
    formatter = FORMATTERS[args.format]
    rendered = formatter(bets, stake_dollars=args.stake, header=header)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as fh:
            fh.write(rendered)
            if not rendered.endswith("\n"):
                fh.write("\n")
    else:
        print(rendered)
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
