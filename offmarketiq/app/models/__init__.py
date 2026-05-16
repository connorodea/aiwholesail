"""
ORM model registry.

Every model must be imported here so Alembic autogenerate sees it. The order
mirrors the FK dependency graph (parents first).
"""

from app.database import Base
from app.models.county import County
from app.models.owner import Owner
from app.models.property import Property
from app.models.scrape_job import ScrapeJob
from app.models.signal import Signal
from app.models.score import PropertyScore

__all__ = [
    "Base",
    "County",
    "Owner",
    "Property",
    "ScrapeJob",
    "Signal",
    "PropertyScore",
]
