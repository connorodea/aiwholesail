"""
County registry. One row per supported county. Holds scraper class names + last
scrape timestamps + priority weight that drives scheduler frequency.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, CHAR, DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class County(Base):
    __tablename__ = "counties"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fips_code: Mapped[str] = mapped_column(String(5), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str] = mapped_column(CHAR(2), nullable=False, index=True)

    # Scraper class names (dotted-path module.Class). NULL = no scraper yet.
    assessor_scraper: Mapped[str | None] = mapped_column(String(100))
    recorder_scraper: Mapped[str | None] = mapped_column(String(100))
    tax_scraper: Mapped[str | None] = mapped_column(String(100))
    probate_scraper: Mapped[str | None] = mapped_column(String(100))
    socrata_domain: Mapped[str | None] = mapped_column(String(200))

    # Last-scraped timestamps per source.
    assessor_last_scraped: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    recorder_last_scraped: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    tax_last_scraped: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Higher priority counties get scraped more frequently by beat.
    priority: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<County {self.fips_code} {self.name}, {self.state}>"
