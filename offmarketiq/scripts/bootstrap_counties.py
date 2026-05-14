"""
Seed the county registry with the 4 priority counties from Phase 0.

Idempotent — re-runs INSERT...ON CONFLICT DO NOTHING.

Usage (inside container):
    docker compose run --rm api python scripts/bootstrap_counties.py

Or via Make:
    make bootstrap
"""

import asyncio
import sys
import uuid

import structlog
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.database import get_session_maker
from app.models.county import County

log = structlog.get_logger()


PRIORITY_COUNTIES = [
    {
        "fips_code": "04013",
        "name": "Maricopa",
        "state": "AZ",
        "priority": 10,
        "assessor_scraper": "app.scrapers.assessors.maricopa_az.MaricopaAssessorScraper",
        "recorder_scraper": "app.scrapers.recorders.maricopa_az.MaricopaRecorderScraper",
        "tax_scraper": "app.scrapers.tax_collectors.maricopa_az.MaricopaTaxScraper",
        "socrata_domain": None,
    },
    {
        "fips_code": "48201",
        "name": "Harris",
        "state": "TX",
        "priority": 10,
        "assessor_scraper": "app.scrapers.assessors.harris_tx.HarrisAssessorScraper",
        "recorder_scraper": "app.scrapers.recorders.harris_tx.HarrisRecorderScraper",
        "tax_scraper": "app.scrapers.tax_collectors.harris_tx.HarrisTaxScraper",
        "socrata_domain": "data.houstontx.gov",
    },
    {
        "fips_code": "17031",
        "name": "Cook",
        "state": "IL",
        "priority": 9,
        "assessor_scraper": "app.scrapers.assessors.cook_il.CookAssessorScraper",
        "recorder_scraper": "app.scrapers.recorders.cook_il.CookRecorderScraper",
        "tax_scraper": "app.scrapers.tax_collectors.cook_il.CookTaxScraper",
        "socrata_domain": "datacatalog.cookcountyil.gov",
    },
    {
        "fips_code": "06037",
        "name": "Los Angeles",
        "state": "CA",
        "priority": 9,
        "assessor_scraper": "app.scrapers.assessors.la_ca.LAAssessorScraper",
        "recorder_scraper": "app.scrapers.recorders.la_ca.LARecorderScraper",
        "tax_scraper": "app.scrapers.tax_collectors.la_ca.LATaxScraper",
        "socrata_domain": "data.lacounty.gov",
    },
]


async def main() -> int:
    session_maker = get_session_maker()
    async with session_maker() as session:
        for c in PRIORITY_COUNTIES:
            stmt = (
                pg_insert(County)
                .values(id=uuid.uuid4(), active=True, **c)
                .on_conflict_do_nothing(index_elements=["fips_code"])
            )
            await session.execute(stmt)
            log.info("county.seed", fips=c["fips_code"], name=c["name"], state=c["state"])
        await session.commit()

    log.info("bootstrap.complete", count=len(PRIORITY_COUNTIES))
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
