"""
Signal event log. APPEND-ONLY per CLAUDE.md — never UPDATE rows.

To deactivate (e.g. NOD followed by reconveyance), insert a new row with the
new state OR rely on `expires_at` for natural decay. The maintenance task
`expire_signals` sets `active=false` once `expires_at < now()`, but it does
NOT mutate the originating event metadata.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


# Canonical signal type names. App-side detectors must use these exactly.
# Add new types here AND in scoring/weights.py — they're version-locked together.
SIGNAL_TYPES = {
    # Distress
    "TAX_DELINQUENT",
    "TAX_DELINQUENT_2YR",
    "NOTICE_OF_DEFAULT",
    "NOTICE_OF_TRUSTEE_SALE",
    "LIS_PENDENS",
    "REO",
    "BANKRUPTCY_CHAPTER_7",
    "BANKRUPTCY_CHAPTER_13",
    "PROBATE_FILING",
    "DIVORCE_FILING",
    "CODE_VIOLATION_OPEN",
    "CODE_VIOLATION_REPEAT",
    "VACANT_USPS",
    "VACANT_VISUAL",
    "IRS_LIEN",
    "MECHANIC_LIEN",
    "HOA_LIEN",
    # Equity
    "FREE_AND_CLEAR",
    "HIGH_EQUITY_40PCT",
    "HIGH_EQUITY_60PCT",
    "UNDERWATER",
    # Ownership
    "ABSENTEE_OWNER",
    "OUT_OF_STATE_OWNER",
    "LLC_OWNED",
    "CORP_OWNED",
    "TRUST_OWNED",
    "INHERITED_PROPERTY",
    "PRE_PROBATE_ELDERLY",
    "TIRED_LANDLORD",
    "LONG_TERM_OWNER_10YR",
    "LONG_TERM_OWNER_20YR",
    # Listing
    "EXPIRED_LISTING",
    "NEVER_LISTED",
}

SIGNAL_CATEGORIES = {"DISTRESS", "EQUITY", "OWNERSHIP", "LISTING"}


class Signal(Base):
    __tablename__ = "signals"
    __table_args__ = (
        Index("ix_signals_property_id", "property_id"),
        Index("ix_signals_signal_type", "signal_type"),
        Index("ix_signals_detected_at", "detected_at"),
        Index("ix_signals_active", "active"),
        # Composite for dedup lookups: is this signal already active for this property?
        Index("ix_signals_property_type_active", "property_id", "signal_type", "active"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"), nullable=False
    )

    signal_type: Mapped[str] = mapped_column(String(80), nullable=False)
    signal_category: Mapped[str] = mapped_column(String(30), nullable=False)

    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    event_date: Mapped[date | None] = mapped_column(Date)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    source: Mapped[str | None] = mapped_column(String(100))
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB)
