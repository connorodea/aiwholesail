"""
Owner entity graph. Names go through the owner_parser (LLC/CORP/TRUST/ESTATE
classification) before reaching the DB. portfolio_count is recomputed nightly
by app.tasks.maintenance_tasks.update_portfolio_counts.

`is_absentee` is a derived/materialized boolean — set by the ETL pass that
compares mailing_address_normalized to the property's address_normalized.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, CHAR, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Owner(Base):
    __tablename__ = "owners"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name_raw: Mapped[str] = mapped_column(Text, nullable=False)
    name_normalized: Mapped[str | None] = mapped_column(String(200), index=True)
    # INDIVIDUAL | LLC | CORP | TRUST | ESTATE | GOVERNMENT
    owner_type: Mapped[str | None] = mapped_column(String(20), index=True)

    mailing_address_raw: Mapped[str | None] = mapped_column(Text)
    mailing_address_normalized: Mapped[str | None] = mapped_column(String(300))
    mailing_city: Mapped[str | None] = mapped_column(String(100))
    mailing_state: Mapped[str | None] = mapped_column(CHAR(2), index=True)
    mailing_zip: Mapped[str | None] = mapped_column(String(10))

    is_absentee: Mapped[bool | None] = mapped_column(Boolean, index=True)
    is_out_of_state: Mapped[bool | None] = mapped_column(Boolean, index=True)
    portfolio_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    portfolio_assessed_value: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
