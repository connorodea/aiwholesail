"""Celery export + webhook tasks. Phase-0 stubs — implemented in Phase 4."""

import structlog
from celery import shared_task

log = structlog.get_logger()


@shared_task(name="app.tasks.export_tasks.generate_csv_export")
def generate_csv_export(export_token: str) -> dict:
    log.warning("export_tasks.stub", task="generate_csv_export", phase="4")
    return {"status": "stub", "phase": 4}


@shared_task(name="app.tasks.export_tasks.deliver_webhook")
def deliver_webhook(webhook_id: str, signal_event_id: str) -> dict:
    log.warning("export_tasks.stub", task="deliver_webhook", phase="4")
    return {"status": "stub", "phase": 4}
