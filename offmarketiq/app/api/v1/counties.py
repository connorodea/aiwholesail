"""
Counties endpoint — list all supported counties with last-scrape metadata.

Phase-0 minimal handler. Public read-only; auth gating added in Phase 4 along
with the rest of the customer-facing endpoints.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.county import County

router = APIRouter()


@router.get("/")
async def list_counties(session: AsyncSession = Depends(get_session)) -> dict:
    stmt = select(County).where(County.active.is_(True)).order_by(County.priority.desc(), County.state, County.name)
    result = await session.execute(stmt)
    counties = result.scalars().all()
    return {
        "count": len(counties),
        "counties": [
            {
                "fips_code": c.fips_code,
                "name": c.name,
                "state": c.state,
                "priority": c.priority,
                "assessor_last_scraped": c.assessor_last_scraped.isoformat() if c.assessor_last_scraped else None,
                "recorder_last_scraped": c.recorder_last_scraped.isoformat() if c.recorder_last_scraped else None,
                "tax_last_scraped": c.tax_last_scraped.isoformat() if c.tax_last_scraped else None,
            }
            for c in counties
        ],
    }
