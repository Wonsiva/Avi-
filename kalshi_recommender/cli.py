"""Command-line entry point for the Kalshi bet recommender."""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from importlib import resources
from pathlib import Path

from .formatter import (
    format_recommendations,
    format_recommendations_html,
    format_recommendations_json,
    format_recommendations_markdown,
)
from .kalshi_client import (
    DEFAULT_BASE_URL,
    DEFAULT_TIMEOUT,
    FetchOptions,
    KalshiClient,
    KalshiError,
    filter_tradable,
)
from .scoring import MODES, score_markets

FORMATTERS = {
    "text": format_recommendations,
    "html": format_recommendations_html,
    "json": format_recommendations_json,
    "markdown": format_recommendations_markdown,
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
        "--mode",
        choices=MODES,
        default="best",
        help=(
            "recommendation strategy: best (balanced, category-diverse), "
            "underdog (overlooked longshots with volume), "
            "momentum (price movers), value (classic sweet-spot), "
            "safe (high-probability yields). Default: best"
        ),
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
        help="output format: text (default), html, markdown, or json",
    )
    parser.add_argument(
        "--output",
        "-o",
        default=None,
        help="write output to this file instead of stdout",
    )
    parser.add_argument(
        "--performance",
        action="store_true",
        help="show the performance report (signal accuracy, win rate, ROI) instead of picks",
    )
    parser.add_argument(
        "--track",
        action="store_true",
        help="record the current picks in the history for future learning",
    )
    parser.add_argument(
        "--learn",
        action="store_true",
        help="run the learning loop: analyze signal performance and update weights",
    )
    parser.add_argument(
        "--demo-history",
        action="store_true",
        help="load bundled sample history into the data directory for demo purposes",
    )
    parser.add_argument(
        "--data-dir",
        default=None,
        help="override the data directory for history/weights (default: ~/.kalshi-recommender/)",
    )
    parser.add_argument(
        "--fail-if-empty",
        action="store_true",
        help=(
            "exit with status 3 if no recommendations were produced. "
            "Used by CI/workflows so an empty live-API response doesn't "
            "overwrite a good static file."
        ),
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="print diagnostic info to stderr",
    )
    return parser


def _load_demo_history(data_dir: str | None) -> None:
    """Copy bundled sample_history.json into the data directory."""
    from .tracker import _data_path, HISTORY_FILE

    text = resources.files("kalshi_recommender.data").joinpath(
        "sample_history.json"
    ).read_text(encoding="utf-8")
    path = _data_path(data_dir) / HISTORY_FILE
    path.write_text(text, encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    # --- Demo history setup
    if args.demo_history:
        _load_demo_history(args.data_dir)
        print("Loaded sample history into data directory.", file=sys.stderr)

    # --- Performance report mode
    if args.performance:
        from .learner import format_performance_report
        print(format_performance_report(data_dir=args.data_dir))
        return 0

    # --- Learning mode
    if args.learn:
        from .learner import update_weights, analyze_signals
        stats = analyze_signals(data_dir=args.data_dir)
        result = update_weights(data_dir=args.data_dir)
        if result is None:
            print(
                "Not enough resolved picks to learn from yet. "
                "Need at least 10 resolved picks.",
                file=sys.stderr,
            )
            return 0
        print("Signal performance analyzed and weights updated.", file=sys.stderr)
        from .learner import format_performance_report
        print(format_performance_report(data_dir=args.data_dir))
        return 0

    # --- Main recommendation flow
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
    if args.verbose:
        print(
            f"[diagnostic] fetched {len(markets):,} markets, "
            f"{len(tradable):,} passed the tradable filter",
            file=sys.stderr,
        )
    bets = score_markets(
        tradable, top=args.top, min_volume=args.min_volume, mode=args.mode
    )
    if args.verbose:
        print(
            f"[diagnostic] mode={args.mode} min_volume={args.min_volume} "
            f"-> {len(bets)} recommendation(s)",
            file=sys.stderr,
        )

    if args.fail_if_empty and not bets:
        print(
            "Error: no recommendations produced (fetched "
            f"{len(markets):,} markets, {len(tradable):,} tradable). "
            "Not writing output because --fail-if-empty was set.",
            file=sys.stderr,
        )
        return 3

    # --- Track picks if requested
    if args.track and bets:
        from .tracker import record_picks
        records = record_picks(bets, data_dir=args.data_dir)
        print(
            f"Tracked {len(records)} pick(s) in history.",
            file=sys.stderr,
        )

    mode_label = {
        "best": "best overall",
        "underdog": "overlooked underdogs",
        "momentum": "momentum plays",
        "value": "best risk-reward value",
        "safe": "safer high-probability yields",
    }.get(args.mode, args.mode)
    header = (
        f"Analyzed {len(tradable):,} tradable Kalshi markets from {source}. "
        f"Mode: {mode_label}."
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
