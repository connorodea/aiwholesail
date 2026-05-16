"""
Phase-0 smoke test. Confirms that:
  1. The app package imports cleanly (no circular / missing-symbol errors)
  2. The FastAPI app builds and /health responds 200
  3. The Celery app imports cleanly + all task modules register
  4. BaseScraper ABC enforces required overrides
  5. SocrataGenericScraper subclassing works

This is the ONLY thing in the test suite for Phase 0. Real coverage starts in
Phase 1 (scrapers) and Phase 4 (scoring + API).
"""

import pytest
from fastapi.testclient import TestClient


@pytest.mark.unit
def test_app_imports_cleanly() -> None:
    from app.main import app  # noqa: F401
    from app.celery_app import celery_app  # noqa: F401
    from app import models  # noqa: F401


@pytest.mark.unit
def test_health_endpoint() -> None:
    from app.main import app

    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.unit
def test_celery_tasks_registered() -> None:
    from app.celery_app import celery_app

    registered = set(celery_app.tasks.keys())
    expected = {
        "app.tasks.scrape_tasks.scrape_county_assessor",
        "app.tasks.scrape_tasks.scrape_all_recorders_delta",
        "app.tasks.scrape_tasks.scrape_all_tax_delinquency",
        "app.tasks.etl_tasks.score_batch",
        "app.tasks.etl_tasks.refresh_all_scores",
        "app.tasks.maintenance_tasks.expire_signals",
    }
    missing = expected - registered
    assert not missing, f"Celery tasks not registered: {missing}"


@pytest.mark.unit
def test_base_scraper_requires_abstract_methods() -> None:
    from app.scrapers.base import BaseScraper

    with pytest.raises(TypeError):
        BaseScraper()  # type: ignore[abstract]


@pytest.mark.unit
def test_socrata_scraper_subclass_must_override_map_record() -> None:
    from app.scrapers.assessors.socrata import SocrataGenericScraper

    class TestSocrata(SocrataGenericScraper):
        SOCRATA_DOMAIN = "data.example.gov"
        SOCRATA_DATASET_ID = "abcd-1234"

    scraper = TestSocrata(county_fips="00001")
    with pytest.raises(NotImplementedError):
        scraper._map_record({"foo": "bar"})


@pytest.mark.unit
def test_signal_types_registry_is_set() -> None:
    from app.models.signal import SIGNAL_TYPES, SIGNAL_CATEGORIES

    # Spec calls out 33 signal types. Allow a couple of registry tweaks but
    # catastrophic drift should fail this guard.
    assert len(SIGNAL_TYPES) >= 25
    assert SIGNAL_CATEGORIES == {"DISTRESS", "EQUITY", "OWNERSHIP", "LISTING"}
    # Crown jewels — these MUST exist (scoring engine depends on them).
    for required in ["NOTICE_OF_DEFAULT", "NOTICE_OF_TRUSTEE_SALE", "TAX_DELINQUENT",
                     "ABSENTEE_OWNER", "FREE_AND_CLEAR", "HIGH_EQUITY_60PCT"]:
        assert required in SIGNAL_TYPES, f"missing required signal type: {required}"
