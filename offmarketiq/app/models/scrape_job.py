"""
Scrape job run log. One row per scraper invocation.

Critical for operational visibility — alert dashboards key off failures here.
`scrape_do_calls` and `vision_fallback_calls` are cost-tracking counters.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ScrapeJob(Base):
    __tablename__ = "scrape_jobs"
    __table_args__ = (
        Index("ix_scrape_jobs_county_started", "county_id", "started_at"),
        Index("ix_scrape_jobs_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    county_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("counties.id", ondelete="SET NULL"), nullable=True
    )
    # ASSESSOR | RECORDER | TAX | PROBATE | CODE | BANKRUPTCY
    job_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # PENDING | RUNNING | COMPLETE | FAILED
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING")

    records_scraped: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_upserted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_failed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error_message: Mapped[str | None] = mapped_column(Text)

    # Cost tracking
    scrape_do_calls: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    vision_fallback_calls: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
