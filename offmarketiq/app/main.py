"""
FastAPI application factory.

Wires up logging, middleware, the /api/v1 router, and a basic /health endpoint.
Routes are registered via app.api.v1.router — keep this file thin.
"""

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_v1_router
from app.config import get_settings

log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup + shutdown hooks. Initialize once-per-process resources here."""
    settings = get_settings()
    log.info("app.startup", environment=settings.environment, log_level=settings.log_level)
    yield
    log.info("app.shutdown")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="OffMarketIQ",
        version="0.1.0",
        description="Off-market property data API — distress, equity, ownership signals + propensity scoring.",
        # Never expose internal scoring metadata via OpenAPI examples. Keep schemas
        # opaque for IP-sensitive fields.
        openapi_url="/openapi.json" if not settings.is_prod else None,
        docs_url="/docs" if not settings.is_prod else None,
        redoc_url=None,
        lifespan=lifespan,
    )

    # In dev we serve same-origin behind nginx; CORS exists for direct API consumers
    # (e.g. customer integrations). Tighten this allow list once we know who's calling.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if not settings.is_prod else [],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_v1_router, prefix="/api/v1")

    @app.get("/health", tags=["meta"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
