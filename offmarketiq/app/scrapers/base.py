"""
BaseScraper — the ABC every county scraper extends.

Lifecycle:
  fetch()     → raw page (HTML/JSON/bytes)
  parse()     → list[dict] of partially-typed records
  normalize() → list[PropertyRecord] with canonical shape
  upsert()    → write to DB; return UpsertResult counts

The concrete `run()` method orchestrates the four steps inside a ScrapeJob
context, captures counts + errors, and writes the job row when done. One
county failure must NOT kill the worker process (per CLAUDE.md).

`scrape_do_get()` and `vision_extract()` are convenience proxies so subclass
code stays terse.
"""

from __future__ import annotations

import abc
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import structlog
from sqlalchemy import update

from app.database import get_session_maker
from app.models.scrape_job import ScrapeJob
from app.scrapers import scrape_do, vision

log = structlog.get_logger()


@dataclass(slots=True)
class PropertyRecord:
    """Normalized canonical shape — what `upsert()` writes to DB."""

    parcel_id: str
    county_fips: str
    address_raw: str | None = None
    owner_name_raw: str | None = None
    owner_mailing_address_raw: str | None = None
    year_built: int | None = None
    sq_ft: int | None = None
    lot_sq_ft: int | None = None
    bedrooms: int | None = None
    bathrooms: float | None = None
    assessed_value_cents: int | None = None
    last_sale_date: str | None = None  # YYYY-MM-DD
    last_sale_price_cents: int | None = None
    last_sale_deed_type: str | None = None
    tax_annual_cents: int | None = None
    source_raw: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class UpsertResult:
    upserted: int = 0
    failed: int = 0


@dataclass(slots=True)
class ScrapeJobResult:
    scraped: int = 0
    upserted: int = 0
    failed: int = 0
    scrape_do_calls: int = 0
    vision_fallback_calls: int = 0
    error: str | None = None


class ParseError(Exception):
    """Raised when an HTML/JSON parser can't extract enough fields. Triggers Vision fallback."""


class BaseScraper(abc.ABC):
    """Abstract base. Each subclass declares the county it targets + strategy doc."""

    # Subclasses override these
    job_type: str = "ASSESSOR"  # ASSESSOR | RECORDER | TAX | PROBATE | CODE
    min_fields_for_parse_success: int = 3
    """If `parse()` returns records with fewer than this many populated fields,
    Vision is invoked. Per CLAUDE.md."""

    def __init__(self, *, county_id: uuid.UUID | None = None, county_fips: str | None = None) -> None:
        self.county_id = county_id
        self.county_fips = county_fips
        self._result = ScrapeJobResult()

    # -------------------- Abstract methods --------------------

    @abc.abstractmethod
    async def fetch(self, target: str) -> str | bytes:
        """Hit the source and return raw page content."""

    @abc.abstractmethod
    async def parse(self, raw: str | bytes) -> list[dict]:
        """Convert raw to a list of unprocessed record dicts."""

    @abc.abstractmethod
    async def normalize(self, parsed: list[dict]) -> list[PropertyRecord]:
        """Map parsed dicts to canonical PropertyRecord shape."""

    @abc.abstractmethod
    async def upsert(self, records: list[PropertyRecord]) -> UpsertResult:
        """Write records to DB. Must be idempotent."""

    # -------------------- Concrete helpers --------------------

    async def scrape_do_get(
        self,
        url: str,
        *,
        js_render: bool = False,
        screenshot: bool = False,
        custom_headers: dict[str, str] | None = None,
    ) -> scrape_do.ScrapeResult:
        """Proxy to scrape_do.fetch() with call-count tracking."""
        self._result.scrape_do_calls += 1
        return await scrape_do.fetch(
            url,
            js_render=js_render,
            screenshot=screenshot,
            custom_headers=custom_headers,
        )

    async def vision_extract(self, screenshot_bytes: bytes, *, fields: list[str] | None = None) -> dict:
        """Proxy to vision.vision_extract() with call-count tracking."""
        self._result.vision_fallback_calls += 1
        return await vision.vision_extract(screenshot_bytes, fields=fields)

    # -------------------- Orchestrator --------------------

    async def run(self, *, target: str) -> ScrapeJobResult:
        """
        End-to-end: fetch → parse → (vision fallback) → normalize → upsert.

        Wraps the entire run in a ScrapeJob row so operational dashboards have
        a single source of truth for success/failure rates.
        """
        job = ScrapeJob(
            id=uuid.uuid4(),
            county_id=self.county_id,
            job_type=self.job_type,
            status="RUNNING",
            started_at=datetime.now(timezone.utc),
        )
        session_maker = get_session_maker()
        async with session_maker() as session:
            session.add(job)
            await session.commit()

        try:
            raw = await self.fetch(target)
            parsed = await self.parse(raw)
            self._result.scraped = len(parsed)

            # Vision fallback trigger: parsed records too sparse
            if self._should_trigger_vision(parsed):
                log.info("scraper.vision_fallback_triggered", scraper=type(self).__name__)
                shot = await self.scrape_do_get(target, js_render=True, screenshot=True)
                extracted = await self.vision_extract(shot.content)
                parsed.append(extracted)

            records = await self.normalize(parsed)
            upsert_result = await self.upsert(records)
            self._result.upserted = upsert_result.upserted
            self._result.failed = upsert_result.failed

        except Exception as exc:
            log.exception("scraper.failed", scraper=type(self).__name__)
            self._result.error = f"{type(exc).__name__}: {exc}"
            await self._finalize_job(job, status="FAILED")
            return self._result

        await self._finalize_job(job, status="COMPLETE")
        return self._result

    def _should_trigger_vision(self, parsed: list[dict]) -> bool:
        if not parsed:
            return True
        sample = parsed[0]
        populated = sum(1 for v in sample.values() if v not in (None, "", []))
        return populated < self.min_fields_for_parse_success

    async def _finalize_job(self, job: ScrapeJob, *, status: str) -> None:
        session_maker = get_session_maker()
        async with session_maker() as session:
            await session.execute(
                update(ScrapeJob)
                .where(ScrapeJob.id == job.id)
                .values(
                    status=status,
                    completed_at=datetime.now(timezone.utc),
                    records_scraped=self._result.scraped,
                    records_upserted=self._result.upserted,
                    records_failed=self._result.failed,
                    scrape_do_calls=self._result.scrape_do_calls,
                    vision_fallback_calls=self._result.vision_fallback_calls,
                    error_message=self._result.error,
                )
            )
            await session.commit()
