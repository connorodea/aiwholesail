"""
Daily propensity score snapshots. One row per property per scoring run.

The latest score for a property is always `MAX(scored_at) WHERE property_id = X`.
We keep the history so list-builder queries can filter on score deltas (e.g.
"properties that crossed into HIGH tier in the last 30 days").
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, SmallInteger, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PropertyScore(Base):
    __tablename__ = "property_scores"
    __table_args__ = (
        Index("ix_property_scores_property_id", "property_id"),
        Index("ix_property_scores_score_desc", "score", postgresql_ops={"score": "DESC"}),
        Index("ix_property_scores_scored_at", "scored_at"),
        # Latest-score lookup pattern.
        Index(
            "ix_property_scores_property_scored_desc",
            "property_id", "scored_at",
            postgresql_ops={"scored_at": "DESC"},
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"), nullable=False
    )

    score: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    # HIGH | MEDIUM | LOW — bucketed from `score` for fast tier filters.
    score_tier: Mapped[str] = mapped_column(String(10), nullable=False)
    signal_count: Mapped[int | None] = mapped_column(SmallInteger)
    # Snapshot of active signal types at scoring time — supports "why is this 70?" audits
    # WITHOUT exposing the weight table.
    active_signals: Mapped[list | None] = mapped_column(JSONB)
    # Version-pinned to the weights file revision so historical scores stay reproducible.
    model_version: Mapped[str] = mapped_column(String(20), nullable=False)

    scored_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
