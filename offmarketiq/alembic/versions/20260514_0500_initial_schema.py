"""Initial schema: counties, properties, owners, property_owners, mortgage_records, signals, property_scores, scrape_jobs.

Creates the PostGIS extension and all Phase-0 tables. Indexes are co-located
with table creation to keep the migration self-contained.

Per CLAUDE.md: every new table gets a GRANT block at the bottom.

Revision ID: 20260514_0500
Revises:
Create Date: 2026-05-14 05:00:00.000000
"""

from typing import Sequence, Union

import geoalchemy2  # noqa: F401 — registers Geometry type with sqlalchemy
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260514_0500"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # PostGIS — required by properties.geom
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    # -------- counties --------
    op.create_table(
        "counties",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("fips_code", sa.String(5), nullable=False, unique=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("state", sa.CHAR(2), nullable=False),
        sa.Column("assessor_scraper", sa.String(100)),
        sa.Column("recorder_scraper", sa.String(100)),
        sa.Column("tax_scraper", sa.String(100)),
        sa.Column("probate_scraper", sa.String(100)),
        sa.Column("socrata_domain", sa.String(200)),
        sa.Column("assessor_last_scraped", sa.DateTime(timezone=True)),
        sa.Column("recorder_last_scraped", sa.DateTime(timezone=True)),
        sa.Column("tax_last_scraped", sa.DateTime(timezone=True)),
        sa.Column("active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("priority", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_counties_state", "counties", ["state"])

    # -------- owners --------
    op.create_table(
        "owners",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name_raw", sa.Text, nullable=False),
        sa.Column("name_normalized", sa.String(200)),
        sa.Column("owner_type", sa.String(20)),
        sa.Column("mailing_address_raw", sa.Text),
        sa.Column("mailing_address_normalized", sa.String(300)),
        sa.Column("mailing_city", sa.String(100)),
        sa.Column("mailing_state", sa.CHAR(2)),
        sa.Column("mailing_zip", sa.String(10)),
        sa.Column("is_absentee", sa.Boolean),
        sa.Column("is_out_of_state", sa.Boolean),
        sa.Column("portfolio_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("portfolio_assessed_value", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_owners_name_normalized", "owners", ["name_normalized"])
    op.create_index("ix_owners_owner_type", "owners", ["owner_type"])
    op.create_index("ix_owners_mailing_state", "owners", ["mailing_state"])
    op.create_index("ix_owners_is_absentee", "owners", ["is_absentee"])
    op.create_index("ix_owners_is_out_of_state", "owners", ["is_out_of_state"])

    # -------- properties --------
    op.create_table(
        "properties",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("parcel_id", sa.String(50), nullable=False),
        sa.Column("county_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("counties.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("address_raw", sa.Text),
        sa.Column("address_normalized", sa.String(300)),
        sa.Column("address_hash", sa.CHAR(64), unique=True),
        sa.Column("street_number", sa.String(20)),
        sa.Column("street_name", sa.String(100)),
        sa.Column("unit", sa.String(20)),
        sa.Column("city", sa.String(100)),
        sa.Column("state", sa.CHAR(2)),
        sa.Column("zip", sa.String(10)),
        sa.Column("zip4", sa.String(4)),
        sa.Column("latitude", sa.Numeric(10, 7)),
        sa.Column("longitude", sa.Numeric(10, 7)),
        sa.Column("geom", geoalchemy2.Geometry(geometry_type="POINT", srid=4326)),
        sa.Column("property_type", sa.String(50)),
        sa.Column("year_built", sa.SmallInteger),
        sa.Column("sq_ft", sa.Integer),
        sa.Column("lot_sq_ft", sa.Integer),
        sa.Column("bedrooms", sa.SmallInteger),
        sa.Column("bathrooms", sa.Numeric(3, 1)),
        sa.Column("stories", sa.SmallInteger),
        sa.Column("assessed_value", sa.Integer),
        sa.Column("assessed_land_value", sa.Integer),
        sa.Column("assessed_improvement_value", sa.Integer),
        sa.Column("market_value_est", sa.Integer),
        sa.Column("tax_annual_amount", sa.Integer),
        sa.Column("tax_year", sa.SmallInteger),
        sa.Column("last_sale_date", sa.Date),
        sa.Column("last_sale_price", sa.Integer),
        sa.Column("last_sale_deed_type", sa.String(50)),
        sa.Column("usps_vacant", sa.Boolean),
        sa.Column("usps_checked_at", sa.DateTime(timezone=True)),
        sa.Column("source_assessor_raw", postgresql.JSONB),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("parcel_id", "county_id", name="uq_properties_parcel_county"),
    )
    op.create_index("ix_properties_address_hash", "properties", ["address_hash"])
    op.create_index("ix_properties_geom", "properties", ["geom"], postgresql_using="gist")
    op.create_index("ix_properties_state_zip", "properties", ["state", "zip"])
    op.create_index("ix_properties_last_sale_date", "properties", ["last_sale_date"])
    op.create_index("ix_properties_assessed_value", "properties", ["assessed_value"])
    op.create_index("ix_properties_updated_at", "properties", ["updated_at"])

    # -------- property_owners (M2M) --------
    op.create_table(
        "property_owners",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("property_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("properties.id", ondelete="CASCADE"), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("owners.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ownership_pct", sa.Numeric(5, 2), server_default="100.00"),
        sa.Column("vesting_type", sa.String(50)),
        sa.Column("as_of_date", sa.Date),
        sa.Column("source", sa.String(50)),
        sa.Column("active", sa.Boolean, nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_property_owners_property_id", "property_owners", ["property_id"])
    op.create_index("ix_property_owners_owner_id", "property_owners", ["owner_id"])

    # -------- mortgage_records --------
    op.create_table(
        "mortgage_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("property_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("properties.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_type", sa.String(50), nullable=False),
        sa.Column("lender_name", sa.String(200)),
        sa.Column("original_amount", sa.BigInteger),
        sa.Column("recording_date", sa.Date),
        sa.Column("document_number", sa.String(100)),
        sa.Column("loan_type", sa.String(50)),
        sa.Column("active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("source_raw", postgresql.JSONB),
    )
    op.create_index("ix_mortgage_records_property_id", "mortgage_records", ["property_id"])
    op.create_index("ix_mortgage_records_recording_date", "mortgage_records", ["recording_date"])

    # -------- signals (append-only) --------
    op.create_table(
        "signals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("property_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("properties.id", ondelete="CASCADE"), nullable=False),
        sa.Column("signal_type", sa.String(80), nullable=False),
        sa.Column("signal_category", sa.String(30), nullable=False),
        sa.Column("detected_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("event_date", sa.Date),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("source", sa.String(100)),
        sa.Column("metadata", postgresql.JSONB),
    )
    op.create_index("ix_signals_property_id", "signals", ["property_id"])
    op.create_index("ix_signals_signal_type", "signals", ["signal_type"])
    op.create_index("ix_signals_detected_at", "signals", ["detected_at"])
    op.create_index("ix_signals_active", "signals", ["active"])
    op.create_index(
        "ix_signals_property_type_active",
        "signals",
        ["property_id", "signal_type", "active"],
    )

    # -------- property_scores --------
    op.create_table(
        "property_scores",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("property_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("properties.id", ondelete="CASCADE"), nullable=False),
        sa.Column("score", sa.SmallInteger, nullable=False),
        sa.Column("score_tier", sa.String(10), nullable=False),
        sa.Column("signal_count", sa.SmallInteger),
        sa.Column("active_signals", postgresql.JSONB),
        sa.Column("model_version", sa.String(20), nullable=False),
        sa.Column("scored_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_property_scores_property_id", "property_scores", ["property_id"])
    op.create_index("ix_property_scores_score_desc", "property_scores", [sa.text("score DESC")])
    op.create_index("ix_property_scores_scored_at", "property_scores", ["scored_at"])
    op.create_index(
        "ix_property_scores_property_scored_desc",
        "property_scores",
        ["property_id", sa.text("scored_at DESC")],
    )

    # -------- scrape_jobs --------
    op.create_table(
        "scrape_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("county_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("counties.id", ondelete="SET NULL")),
        sa.Column("job_type", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="PENDING"),
        sa.Column("records_scraped", sa.Integer, nullable=False, server_default="0"),
        sa.Column("records_upserted", sa.Integer, nullable=False, server_default="0"),
        sa.Column("records_failed", sa.Integer, nullable=False, server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("error_message", sa.Text),
        sa.Column("scrape_do_calls", sa.Integer, nullable=False, server_default="0"),
        sa.Column("vision_fallback_calls", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_index("ix_scrape_jobs_county_started", "scrape_jobs", ["county_id", "started_at"])
    op.create_index("ix_scrape_jobs_status", "scrape_jobs", ["status"])

    # -------- GRANT block (per CLAUDE.md) --------
    # In dev the migration runs as the DB owner, so the GRANT is a no-op. In prod
    # where a separate `offmarketiq_app` role exists, this is the line that keeps
    # the app from silently 500'ing with "permission denied".
    op.execute("""
        GRANT SELECT, INSERT, UPDATE, DELETE ON
          counties, owners, properties, property_owners, mortgage_records,
          signals, property_scores, scrape_jobs
        TO offmarketiq;
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS scrape_jobs CASCADE")
    op.execute("DROP TABLE IF EXISTS property_scores CASCADE")
    op.execute("DROP TABLE IF EXISTS signals CASCADE")
    op.execute("DROP TABLE IF EXISTS mortgage_records CASCADE")
    op.execute("DROP TABLE IF EXISTS property_owners CASCADE")
    op.execute("DROP TABLE IF EXISTS properties CASCADE")
    op.execute("DROP TABLE IF EXISTS owners CASCADE")
    op.execute("DROP TABLE IF EXISTS counties CASCADE")
