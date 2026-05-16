"""
Aggregate v1 router. Each resource is its own module — kept thin.

Phase 0 ships only /counties and /meta. Property/list/score/export endpoints
land in Phase 4 (per CLAUDE.md phased plan).
"""

from fastapi import APIRouter

from app.api.v1 import counties

api_v1_router = APIRouter()
api_v1_router.include_router(counties.router, prefix="/counties", tags=["counties"])
