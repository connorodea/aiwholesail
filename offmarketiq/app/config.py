"""
Application settings via pydantic-settings.

Every env var the app needs is declared here exactly once. Anything trying to
read os.environ directly elsewhere should be treated as a bug — settings load
once at import and are the single source of truth.

Per CLAUDE.md: PACER credentials live in env only, never DB. Secret values
never appear in logs (pydantic SecretStr handles repr).
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # -------- Environment --------
    environment: Literal["development", "staging", "production"] = "development"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    # -------- Database --------
    # Async URL for FastAPI / SQLAlchemy AsyncSession.
    database_url: str = Field(
        default="postgresql+asyncpg://offmarketiq:CHANGE_ME@postgres:5432/offmarketiq"
    )
    # Sync URL for Alembic and Celery beat scheduler.
    database_url_sync: str = Field(
        default="postgresql+psycopg2://offmarketiq:CHANGE_ME@postgres:5432/offmarketiq"
    )

    # -------- Redis --------
    redis_url: str = "redis://redis:6379/0"

    # -------- App secrets --------
    secret_key: SecretStr = SecretStr("CHANGE_ME")

    # -------- scrape.do --------
    scrape_do_api_key: SecretStr = SecretStr("")
    scrape_do_base_url: str = "https://api.scrape.do"
    scrape_do_timeout_seconds: int = 30
    scrape_do_max_retries: int = 3

    # -------- Anthropic (Vision fallback) --------
    anthropic_api_key: SecretStr = SecretStr("")
    anthropic_vision_model: str = "claude-sonnet-4-20250514"
    vision_max_tokens: int = 2048

    # -------- SmartyStreets --------
    smarty_auth_id: SecretStr = SecretStr("")
    smarty_auth_token: SecretStr = SecretStr("")

    # -------- PACER --------
    # Per CLAUDE.md IP firewall: never persisted to DB.
    pacer_username: SecretStr = SecretStr("")
    pacer_password: SecretStr = SecretStr("")

    # -------- Observability --------
    sentry_dsn: str = ""
    prometheus_port: int = 9090

    # -------- Scraper safety --------
    # Hard floor on per-domain rate. 1 req/sec per CLAUDE.md.
    scraper_min_interval_seconds: float = 1.0

    @property
    def is_prod(self) -> bool:
        return self.environment == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings accessor — instantiate once per process."""
    return Settings()
