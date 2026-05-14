"""
Canonical property record. One row per parcel.

`address_hash` is the dedup key — SHA256 of (delivery_line_1 + city + state + zip)
after USPS CASS normalization. Same parcel from two scrapers must collapse to
one Property row via this hash.

`geom` enables PostGIS radius queries on the list-builder endpoint.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from geoalchemy2 import Geometry
from sqlalchemy import (
    CHAR,
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    Index,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Property(Base):
    __tablename__ = "properties"
    __table_args__ = (
        UniqueConstraint("parcel_id", "county_id", name="uq_properties_parcel_county"),
        Index("ix_properties_address_hash", "address_hash"),
        Index("ix_properties_geom", "geom", postgresql_using="gist"),
        Index("ix_properties_state_zip", "state", "zip"),
        Index("ix_properties_last_sale_date", "last_sale_date"),
        Index("ix_properties_assessed_value", "assessed_value"),
        Index("ix_properties_updated_at", "updated_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parcel_id: Mapped[str] = mapped_column(String(50), nullable=False)
    county_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("counties.id", ondelete="RESTRICT"), nullable=False
    )

    # Addresses — raw vs USPS CASS normalized.
    address_raw: Mapped[str | None] = mapped_column(Text)
    address_normalized: Mapped[str | None] = mapped_column(String(300))
    address_hash: Mapped[str | None] = mapped_column(CHAR(64), unique=True)
    street_number: Mapped[str | None] = mapped_column(String(20))
    street_name: Mapped[str | None] = mapped_column(String(100))
    unit: Mapped[str | None] = mapped_column(String(20))
    city: Mapped[str | None] = mapped_column(String(100))
    state: Mapped[str | None] = mapped_column(CHAR(2))
    zip: Mapped[str | None] = mapped_column(String(10))
    zip4: Mapped[str | None] = mapped_column(String(4))

    # Geo. PostGIS Point in WGS84 (EPSG:4326).
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7))
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7))
    geom: Mapped[object | None] = mapped_column(Geometry(geometry_type="POINT", srid=4326))

    # Physical characteristics.
    property_type: Mapped[str | None] = mapped_column(String(50))  # SFR, MFR, CONDO, LAND, COMMERCIAL
    year_built: Mapped[int | None] = mapped_column(SmallInteger)
    sq_ft: Mapped[int | None] = mapped_column(Integer)
    lot_sq_ft: Mapped[int | None] = mapped_column(Integer)
    bedrooms: Mapped[int | None] = mapped_column(SmallInteger)
    bathrooms: Mapped[Decimal | None] = mapped_column(Numeric(3, 1))
    stories: Mapped[int | None] = mapped_column(SmallInteger)

    # Valuation (all monetary values stored in cents — integer math throughout).
    assessed_value: Mapped[int | None] = mapped_column(Integer)
    assessed_land_value: Mapped[int | None] = mapped_column(Integer)
    assessed_improvement_value: Mapped[int | None] = mapped_column(Integer)
    market_value_est: Mapped[int | None] = mapped_column(Integer)
    tax_annual_amount: Mapped[int | None] = mapped_column(Integer)
    tax_year: Mapped[int | None] = mapped_column(SmallInteger)

    # Last recorded sale.
    last_sale_date: Mapped[date | None] = mapped_column(Date)
    last_sale_price: Mapped[int | None] = mapped_column(Integer)
    last_sale_deed_type: Mapped[str | None] = mapped_column(String(50))

    # USPS vacancy overlay.
    usps_vacant: Mapped[bool | None] = mapped_column(Boolean)
    usps_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Raw assessor payload — for re-parsing if our normalizer evolves.
    source_assessor_raw: Mapped[dict | None] = mapped_column(JSONB)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<Property {self.parcel_id} {self.address_normalized or self.address_raw}>"


class PropertyOwner(Base):
    """Many-to-many join with ownership metadata (pct, vesting, as-of date)."""

    __tablename__ = "property_owners"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"), nullable=False, index=True
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("owners.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ownership_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("100.00"))
    vesting_type: Mapped[str | None] = mapped_column(String(50))
    as_of_date: Mapped[date | None] = mapped_column(Date)
    source: Mapped[str | None] = mapped_column(String(50))
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class MortgageRecord(Base):
    """Active + historical mortgages/liens from the recorder. Reconveyances flip active=false."""

    __tablename__ = "mortgage_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"), nullable=False, index=True
    )
    document_type: Mapped[str] = mapped_column(String(50), nullable=False)
    lender_name: Mapped[str | None] = mapped_column(String(200))
    original_amount: Mapped[int | None] = mapped_column(BigInteger)  # cents
    recording_date: Mapped[date | None] = mapped_column(Date, index=True)
    document_number: Mapped[str | None] = mapped_column(String(100))
    loan_type: Mapped[str | None] = mapped_column(String(50))
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    source_raw: Mapped[dict | None] = mapped_column(JSONB)
