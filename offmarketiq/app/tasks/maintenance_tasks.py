"""Celery maintenance tasks. Phase-0 stubs."""

import structlog
from celery import shared_task

log = structlog.get_logger()


@shared_task(name="app.tasks.maintenance_tasks.update_portfolio_counts")
def update_portfolio_counts() -> dict:
    """Recompute owner.portfolio_count and portfolio_assessed_value nightly."""
    log.warning("maintenance_tasks.stub", task="update_portfolio_counts", phase="1")
    return {"status": "stub", "phase": 1}


@shared_task(name="app.tasks.maintenance_tasks.expire_signals")
def expire_signals() -> dict:
    """Flip active=false on signals whose expires_at < now()."""
    log.warning("maintenance_tasks.stub", task="expire_signals", phase="4")
    return {"status": "stub", "phase": 4}


@shared_task(name="app.tasks.maintenance_tasks.purge_stale_jobs")
def purge_stale_jobs(older_than_days: int = 90) -> dict:
    """Delete scrape_jobs rows older than N days to keep the table tight."""
    log.warning("maintenance_tasks.stub", task="purge_stale_jobs", phase="5")
    return {"status": "stub", "phase": 5}
