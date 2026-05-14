"""
Celery tasks for scraping. Phase-0 stubs — every task wires up the beat schedule
in app.celery_app but the actual scraping is implemented in Phases 1-3.

Each task MUST:
  - Resolve the scraper class via the appropriate Registry
  - Wrap exceptions so a single county failure never crashes the worker
  - Use AsyncSession (run via asyncio.run inside the sync Celery task)
"""

from __future__ import annotations

import asyncio

import structlog
from celery import shared_task

log = structlog.get_logger()


@shared_task(name="app.tasks.scrape_tasks.scrape_county_assessor")
def scrape_county_assessor(county_fips: str) -> dict:
    """Phase 1 — drive a single county's assessor scraper end-to-end."""
    log.warning("scrape_tasks.stub", task="scrape_county_assessor", fips=county_fips, phase="1")
    return {"status": "stub", "phase": 1}


@shared_task(name="app.tasks.scrape_tasks.scrape_all_recorders_delta")
def scrape_all_recorders_delta(lookback_days: int = 7) -> dict:
    """Phase 2 — fan out recorder delta pulls for every active county."""
    log.warning("scrape_tasks.stub", task="scrape_all_recorders_delta", phase="2")
    return {"status": "stub", "phase": 2}


@shared_task(name="app.tasks.scrape_tasks.scrape_all_tax_delinquency")
def scrape_all_tax_delinquency() -> dict:
    """Phase 2 — weekly tax delinquency roll pull."""
    log.warning("scrape_tasks.stub", task="scrape_all_tax_delinquency", phase="2")
    return {"status": "stub", "phase": 2}


@shared_task(name="app.tasks.scrape_tasks.scrape_all_probate")
def scrape_all_probate() -> dict:
    """Phase 3 — probate court docket pulls by state."""
    log.warning("scrape_tasks.stub", task="scrape_all_probate", phase="3")
    return {"status": "stub", "phase": 3}


@shared_task(name="app.tasks.scrape_tasks.scrape_all_code_enforcement")
def scrape_all_code_enforcement() -> dict:
    """Phase 3 — Socrata-based code violation ingestion."""
    log.warning("scrape_tasks.stub", task="scrape_all_code_enforcement", phase="3")
    return {"status": "stub", "phase": 3}
