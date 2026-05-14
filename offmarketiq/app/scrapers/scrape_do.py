"""
scrape.do HTTP client wrapper.

Single async function `fetch()` — every county scraper goes through this. The
client knows nothing about parsing; it returns raw bytes or text.

Retry policy (per CLAUDE.md): exponential backoff 2s/4s/8s, max 3 retries.
Hard cap at 1 req/sec per domain — enforced by `_DomainRateLimiter`.

Failure modes:
  - HTTP 429 / 5xx → retry with backoff up to max_retries
  - HTTP 4xx (non-429) → raise ScrapeDoError immediately (don't burn credit)
  - Network/timeout → retry once, then raise
"""

from __future__ import annotations

import asyncio
import time
from collections import defaultdict
from dataclasses import dataclass
from typing import Literal
from urllib.parse import urlencode, urlparse

import httpx
import structlog

from app.config import get_settings

log = structlog.get_logger()


class ScrapeDoError(Exception):
    """Raised on any non-retryable scrape.do failure."""

    def __init__(self, message: str, *, status: int = 0, attempts: int = 1) -> None:
        super().__init__(message)
        self.status = status
        self.attempts = attempts


@dataclass(slots=True)
class ScrapeResult:
    status: int
    content: bytes
    text: str
    headers: dict[str, str]
    attempts: int


class _DomainRateLimiter:
    """Enforce N seconds between requests per target domain. In-process only."""

    def __init__(self, min_interval_seconds: float = 1.0) -> None:
        self._min = min_interval_seconds
        self._last_fired: dict[str, float] = defaultdict(float)
        self._locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

    async def wait(self, domain: str) -> None:
        async with self._locks[domain]:
            wait_needed = self._min - (time.monotonic() - self._last_fired[domain])
            if wait_needed > 0:
                await asyncio.sleep(wait_needed)
            self._last_fired[domain] = time.monotonic()


_rate_limiter = _DomainRateLimiter()


async def fetch(
    target_url: str,
    *,
    js_render: bool = False,
    super_proxy: bool = True,
    screenshot: bool = False,
    custom_headers: dict[str, str] | None = None,
    geo_code: str = "us",
    timeout_seconds: int | None = None,
    max_retries: int | None = None,
    method: Literal["GET", "POST"] = "GET",
    body: bytes | str | None = None,
) -> ScrapeResult:
    """
    Fetch `target_url` through scrape.do.

    - `super_proxy=True` defaults to residential pool (slow but unblockable).
    - `js_render=True` runs a headless browser at the upstream (5x cost — use sparingly).
    - `screenshot=True` returns image bytes for the Vision fallback path.
    - `custom_headers` forwarded verbatim if `js_render=False` (scrape.do
      strips them when rendering).
    """
    settings = get_settings()
    token = settings.scrape_do_api_key.get_secret_value()
    if not token:
        raise ScrapeDoError("SCRAPE_DO_API_KEY not configured")

    timeout = timeout_seconds or settings.scrape_do_timeout_seconds
    retries = max_retries if max_retries is not None else settings.scrape_do_max_retries

    # Rate-limit per target host, not per scrape.do host.
    domain = urlparse(target_url).netloc
    await _rate_limiter.wait(domain)

    params: dict[str, str] = {
        "token": token,
        "url": target_url,
        "geoCode": geo_code,
    }
    if js_render:
        params["render"] = "true"
    if super_proxy:
        params["super"] = "true"
    if screenshot:
        params["screenshot"] = "true"
        params["output"] = "screenshot"
    if custom_headers:
        params["customHeaders"] = "true"

    request_url = f"{settings.scrape_do_base_url}/?{urlencode(params)}"

    last_exc: Exception | None = None
    async with httpx.AsyncClient(timeout=timeout) as client:
        for attempt in range(1, retries + 2):
            try:
                resp = await client.request(
                    method,
                    request_url,
                    headers=custom_headers,
                    content=body,
                )
            except (httpx.TimeoutException, httpx.NetworkError) as exc:
                last_exc = exc
                if attempt > retries:
                    raise ScrapeDoError(
                        f"scrape.do network error after {attempt} attempts: {exc}",
                        attempts=attempt,
                    ) from exc
                await asyncio.sleep(2 ** attempt)
                continue

            # 200-class — success
            if 200 <= resp.status_code < 300:
                return ScrapeResult(
                    status=resp.status_code,
                    content=resp.content,
                    text=resp.text,
                    headers=dict(resp.headers),
                    attempts=attempt,
                )

            # 429 / 5xx — retry with backoff
            if resp.status_code == 429 or resp.status_code >= 500:
                if attempt > retries:
                    raise ScrapeDoError(
                        f"scrape.do HTTP {resp.status_code} after {attempt} attempts",
                        status=resp.status_code,
                        attempts=attempt,
                    )
                log.warning(
                    "scrape_do.retry",
                    target=target_url,
                    status=resp.status_code,
                    attempt=attempt,
                )
                await asyncio.sleep(2 ** attempt)
                continue

            # 4xx (non-429) — hard fail, don't burn more credits
            raise ScrapeDoError(
                f"scrape.do HTTP {resp.status_code}: {resp.text[:200]}",
                status=resp.status_code,
                attempts=attempt,
            )

    # Shouldn't reach — loop returns or raises.
    raise ScrapeDoError(
        f"scrape.do unreachable failure path: {last_exc}",
        attempts=retries + 1,
    )
