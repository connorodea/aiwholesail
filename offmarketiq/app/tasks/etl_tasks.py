"""Celery ETL + scoring tasks. Phase-0 stubs."""

import structlog
from celery import shared_task

log = structlog.get_logger()


@shared_task(name="app.tasks.etl_tasks.normalize_batch")
def normalize_batch(batch_ids: list[str]) -> dict:
    log.warning("etl_tasks.stub", task="normalize_batch", phase="1")
    return {"status": "stub", "phase": 1}


@shared_task(name="app.tasks.etl_tasks.extract_signals_batch")
def extract_signals_batch(property_ids: list[str]) -> dict:
    log.warning("etl_tasks.stub", task="extract_signals_batch", phase="4")
    return {"status": "stub", "phase": 4}


@shared_task(name="app.tasks.etl_tasks.score_batch")
def score_batch(property_ids: list[str]) -> dict:
    log.warning("etl_tasks.stub", task="score_batch", phase="4")
    return {"status": "stub", "phase": 4}


@shared_task(name="app.tasks.etl_tasks.score_recently_touched")
def score_recently_touched() -> dict:
    """Score everything touched in last 24h. Beat-scheduled."""
    log.warning("etl_tasks.stub", task="score_recently_touched", phase="4")
    return {"status": "stub", "phase": 4}


@shared_task(name="app.tasks.etl_tasks.refresh_all_scores")
def refresh_all_scores() -> dict:
    """Weekly full rescore — recency decay means scores shift over time."""
    log.warning("etl_tasks.stub", task="refresh_all_scores", phase="4")
    return {"status": "stub", "phase": 4}
