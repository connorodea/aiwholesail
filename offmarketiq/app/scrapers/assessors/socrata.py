"""
Generic Socrata Open Data client.

Replaces scraping for any county whose assessor publishes to Socrata
(Cook County IL, LA County CA, many others). Pure REST — no scrape.do,
no Vision, no rate-limit anxiety.

API contract:
  GET https://{domain}/resource/{dataset_id}.json
    ?$limit=50000
    &$offset={offset}
    &$where=updated_at > '{iso}'   (optional, for delta pulls)

Pagination: offset-based until an empty page comes back.

Field mapping is dataset-specific — each subclass overrides `_map_record()`
to convert Socrata's source fields into our PropertyRecord shape.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

import httpx
import structlog

from app.scrapers.base import BaseScraper, ParseError, PropertyRecord, UpsertResult

log = structlog.get_logger()


class SocrataGenericScraper(BaseScraper):
    """
    Base class for Socrata-backed assessors. Concrete subclasses override:
      - SOCRATA_DOMAIN
      - SOCRATA_DATASET_ID
      - _map_record()

    Per CLAUDE.md, this strategy is the FIRST choice for any new county. Avoids
    scrape.do entirely and gets us full county coverage in one paginated stream.
    """

    job_type = "ASSESSOR"
    SOCRATA_DOMAIN: str = ""        # e.g. "data.lacounty.gov"
    SOCRATA_DATASET_ID: str = ""    # e.g. "9trm-uz8i"
    PAGE_SIZE: int = 50_000          # Socrata caps at 50k per page

    def __init__(
        self,
        *,
        county_id=None,
        county_fips: str | None = None,
        since: datetime | None = None,
    ) -> None:
        super().__init__(county_id=county_id, county_fips=county_fips)
        self.since = since

    # -------------------- BaseScraper hooks --------------------

    async def fetch(self, target: str) -> list[dict]:
        """`target` is ignored — Socrata domain/dataset are class attrs."""
        if not self.SOCRATA_DOMAIN or not self.SOCRATA_DATASET_ID:
            raise ParseError(
                f"{type(self).__name__} missing SOCRATA_DOMAIN/SOCRATA_DATASET_ID"
            )
        url = f"https://{self.SOCRATA_DOMAIN}/resource/{self.SOCRATA_DATASET_ID}.json"
        params_base: dict[str, str] = {"$limit": str(self.PAGE_SIZE)}
        if self.since:
            params_base["$where"] = f"updated_at > '{self.since.isoformat()}'"

        all_rows: list[dict] = []
        offset = 0
        async with httpx.AsyncClient(timeout=60) as client:
            while True:
                params = {**params_base, "$offset": str(offset)}
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                page = resp.json()
                if not page:
                    break
                all_rows.extend(page)
                if len(page) < self.PAGE_SIZE:
                    break
                offset += self.PAGE_SIZE
                log.debug("socrata.page", domain=self.SOCRATA_DOMAIN, offset=offset, rows=len(all_rows))

        log.info("socrata.fetch_complete", rows=len(all_rows), dataset=self.SOCRATA_DATASET_ID)
        return all_rows

    async def parse(self, raw: list[dict]) -> list[dict]:
        """Socrata returns JSON list — pass-through. Subclasses can override for cleanup."""
        return raw

    async def normalize(self, parsed: list[dict]) -> list[PropertyRecord]:
        if not self.county_fips:
            raise ValueError("county_fips required to normalize records")
        records: list[PropertyRecord] = []
        for row in parsed:
            try:
                rec = self._map_record(row)
                if rec.parcel_id:
                    records.append(rec)
            except Exception:
                log.exception("socrata.normalize_error", row=row)
        return records

    async def upsert(self, records: list[PropertyRecord]) -> UpsertResult:
        """
        Phase-0 stub. The real upsert (PostGIS geom + SmartyStreets normalize +
        owner dedup) lands in Phase 1 alongside the first concrete assessor.
        For now we just count records — keeps the run() lifecycle exercisable
        in tests without DB writes for non-FK rows.
        """
        log.warning(
            "socrata.upsert_stub",
            count=len(records),
            note="Phase 1 will implement real upsert with PostGIS + Smarty",
        )
        return UpsertResult(upserted=len(records), failed=0)

    # -------------------- Subclass override --------------------

    def _map_record(self, row: dict[str, Any]) -> PropertyRecord:  # pragma: no cover
        """
        Map a single Socrata row to a PropertyRecord. Subclass must override.

        Example for Cook County:
            return PropertyRecord(
                parcel_id=row["pin"],
                county_fips="17031",
                address_raw=f"{row.get('property_address')} {row.get('city')} IL {row.get('zip')}",
                ...
            )
        """
        raise NotImplementedError(
            f"{type(self).__name__} must override _map_record(row)"
        )
