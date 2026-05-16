"""
Celery factory + task discovery.

Queues:
  scrape       — county scrapers (assessor, recorder, tax, probate, code)
  etl          — normalization, signal extraction, dedup
  scoring      — propensity scorer batch + refresh
  maintenance  — portfolio recount, signal expiry, score cleanup

Beat schedules live in app.tasks.scrape_tasks and friends, registered via
@celery_app.on_after_configure.connect hooks.
"""

from celery import Celery
from celery.schedules import crontab

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "offmarketiq",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.tasks.scrape_tasks",
        "app.tasks.etl_tasks",
        "app.tasks.export_tasks",
        "app.tasks.maintenance_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,                 # re-deliver on worker crash
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,        # fair scheduling for long scrapes
    task_track_started=True,
    result_expires=86400,
    task_routes={
        "app.tasks.scrape_tasks.*": {"queue": "scrape"},
        "app.tasks.etl_tasks.*": {"queue": "etl"},
        "app.tasks.export_tasks.*": {"queue": "etl"},
        "app.tasks.maintenance_tasks.*": {"queue": "maintenance"},
    },
)


# Beat schedule — periodic tasks. Times are UTC.
celery_app.conf.beat_schedule = {
    "scrape_recorder_delta_daily": {
        "task": "app.tasks.scrape_tasks.scrape_all_recorders_delta",
        "schedule": crontab(hour=2, minute=0),  # 02:00 UTC daily
    },
    "scrape_tax_delinquency_weekly": {
        "task": "app.tasks.scrape_tasks.scrape_all_tax_delinquency",
        "schedule": crontab(day_of_week=0, hour=3, minute=0),  # Sunday 03:00
    },
    "scrape_probate_weekly": {
        "task": "app.tasks.scrape_tasks.scrape_all_probate",
        "schedule": crontab(day_of_week=1, hour=4, minute=0),  # Monday 04:00
    },
    "scrape_code_enforcement_weekly": {
        "task": "app.tasks.scrape_tasks.scrape_all_code_enforcement",
        "schedule": crontab(day_of_week=2, hour=3, minute=0),  # Tuesday 03:00
    },
    "score_batch_daily": {
        "task": "app.tasks.etl_tasks.score_recently_touched",
        "schedule": crontab(hour=5, minute=0),
    },
    "refresh_all_scores_weekly": {
        "task": "app.tasks.etl_tasks.refresh_all_scores",
        "schedule": crontab(day_of_week=0, hour=6, minute=0),
    },
    "update_portfolio_counts_daily": {
        "task": "app.tasks.maintenance_tasks.update_portfolio_counts",
        "schedule": crontab(hour=7, minute=0),
    },
    "expire_signals_daily": {
        "task": "app.tasks.maintenance_tasks.expire_signals",
        "schedule": crontab(hour=8, minute=0),
    },
}
