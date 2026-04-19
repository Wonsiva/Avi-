"""Thin wrapper around Kalshi's public REST API.

Kalshi exposes an unauthenticated read-only `GET /markets` endpoint that
returns paginated market data. We only need the public market snapshot to
build recommendations, so this client deliberately skips authentication.

If the network is unavailable (sandbox, CI without egress, etc.) the caller
can fall back to bundled sample data via :meth:`KalshiClient.load_sample`.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from importlib import resources
from typing import Iterable, Iterator

DEFAULT_BASE_URL = "https://api.elections.kalshi.com/trade-api/v2"
DEFAULT_TIMEOUT = 10.0
DEFAULT_USER_AGENT = "kalshi-recommender/0.1 (+https://kalshi.com)"


class KalshiError(RuntimeError):
    """Raised when the Kalshi API returns an error or is unreachable."""


@dataclass(frozen=True)
class FetchOptions:
    status: str = "open"
    page_size: int = 200
    max_markets: int = 1000


class KalshiClient:
    """Minimal client for Kalshi's public market endpoints."""

    def __init__(
        self,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
        user_agent: str = DEFAULT_USER_AGENT,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.user_agent = user_agent

    # ---------------------------------------------------------------- live
    def fetch_markets(self, options: FetchOptions | None = None) -> list[dict]:
        """Fetch markets from Kalshi, walking pagination until exhausted.

        Returns a list of raw market dicts (the shape Kalshi returns under
        the ``markets`` key in the response).
        """
        opts = options or FetchOptions()
        return list(self._iter_markets(opts))

    def _iter_markets(self, opts: FetchOptions) -> Iterator[dict]:
        cursor: str | None = None
        seen = 0
        while True:
            params = {"limit": str(opts.page_size), "status": opts.status}
            if cursor:
                params["cursor"] = cursor
            url = f"{self.base_url}/markets?{urllib.parse.urlencode(params)}"
            payload = self._get_json(url)
            markets = payload.get("markets") or []
            for market in markets:
                yield market
                seen += 1
                if seen >= opts.max_markets:
                    return
            cursor = payload.get("cursor") or None
            if not cursor or not markets:
                return

    def _get_json(self, url: str) -> dict:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": self.user_agent,
                "Accept": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                body = resp.read()
        except urllib.error.HTTPError as exc:  # pragma: no cover - network
            raise KalshiError(
                f"Kalshi API returned HTTP {exc.code} for {url}"
            ) from exc
        except urllib.error.URLError as exc:  # pragma: no cover - network
            raise KalshiError(
                f"Could not reach Kalshi API at {url}: {exc.reason}"
            ) from exc
        try:
            return json.loads(body)
        except json.JSONDecodeError as exc:
            raise KalshiError(
                f"Kalshi returned non-JSON response from {url}"
            ) from exc

    # ------------------------------------------------------------- offline
    @staticmethod
    def load_sample() -> list[dict]:
        """Load the bundled sample of Kalshi-shaped markets.

        Useful for offline development, demos, and tests so that the rest of
        the pipeline can run without network access.
        """
        text = resources.files("kalshi_recommender.data").joinpath(
            "sample_markets.json"
        ).read_text(encoding="utf-8")
        data = json.loads(text)
        markets = data.get("markets") if isinstance(data, dict) else data
        if not isinstance(markets, list):
            raise KalshiError("sample_markets.json is malformed")
        return markets


def filter_tradable(markets: Iterable[dict]) -> list[dict]:
    """Keep only markets that are open and have a usable order book.

    A market is considered tradable here if:

    * its status looks "active" (``open``, ``active``, or ``initialized``)
    * at least one of ``yes_ask`` / ``no_ask`` is a number strictly
      between 1 and 99 cents

    Markets at the extremes (1 or 99) are skipped for that side because
    they offer either no upside or no realistic chance of winning, but
    we'll still keep the market if the *other* side is in range.
    """
    active_statuses = {"open", "active", "initialized", "initializing"}
    out: list[dict] = []
    for m in markets:
        status = (m.get("status") or "").lower()
        if status not in active_statuses:
            continue
        yes_ask = m.get("yes_ask")
        no_ask = m.get("no_ask")
        yes_ok = isinstance(yes_ask, (int, float)) and 1 < yes_ask < 100
        no_ok = isinstance(no_ask, (int, float)) and 1 < no_ask < 100
        if not (yes_ok or no_ok):
            continue
        out.append(m)
    return out
