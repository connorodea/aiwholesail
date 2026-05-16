# OffMarketIQ

National off-market property data platform. Ingests county assessor, recorder, tax collector, probate, code enforcement, and court data. Normalizes to a canonical property graph, extracts distress / equity / ownership signals, scores each property 0–100, and exposes a FastAPI query layer.

**Direct competitor to BatchData and PropStream at ~95% lower COGS.**

> ⚠️ Read [`CLAUDE.md`](./CLAUDE.md) first. It is the IP firewall + operating manual.

## Where this lives

OffMarketIQ is a subproject inside the **aiwholesail** monorepo at `offmarketiq/`. It's a standalone Python service — its own Docker stack, its own database, its own deploy lifecycle, separate from the aiwholesail Node API. All `make`, `docker compose`, and `alembic` commands assume you're `cd`'d into `offmarketiq/`.

## Stack

Python 3.12 · FastAPI · Celery · PostgreSQL 16 + PostGIS · scrape.do · Claude Sonnet 4 Vision · SmartyStreets · scikit-learn / XGBoost · Docker · Hetzner.

## Status

**Phase 0 — Foundation** (this commit). Scaffolds project structure, Docker stack, ORM models, BaseScraper ABC, scrape.do client, Vision fallback, Socrata generic, county registry seed. No live data yet — Phase 1 starts ingestion.

| Phase | Status | Goal |
|---|---|---|
| **0 — Foundation** | ✅ shipping now | Scaffold + Docker + models + base scraper |
| 1 — Assessor Ingestion | next | 4 county assessors + ETL + first 4 signals |
| 2 — Distress Signals | | Recorders + tax + deed/doc classifiers |
| 3 — Supplemental Signals | | Code enforcement + PACER + probate + USPS vacancy |
| 4 — Scoring + API | | PropensityScorer + endpoints + auth + export |
| 5 — Hardening | | Prometheus + Grafana + tests + SSL |

## Quick start (local)

```bash
cp .env.example .env
# Fill in: SCRAPE_DO_API_KEY, ANTHROPIC_API_KEY, SMARTY_AUTH_ID, SMARTY_AUTH_TOKEN, SECRET_KEY

make build          # build the api image
make up             # start postgres + redis + api + worker + beat
make migrate        # apply alembic migrations
make bootstrap      # seed 4 priority counties
make test-unit      # phase-0 smoke tests
```

API is then up at `http://localhost:8000` — see `/docs` for the OpenAPI UI (dev only).

## Layout

See `CLAUDE.md` § Project shape for the full tree. Key entry points:

- `app/main.py` — FastAPI factory
- `app/celery_app.py` — Celery + beat schedule
- `app/scrapers/base.py` — BaseScraper ABC every scraper extends
- `app/scrapers/scrape_do.py` — scrape.do HTTP client with retries + per-domain rate limit
- `app/scrapers/vision.py` — Claude Sonnet 4 fallback extractor
- `app/scrapers/assessors/socrata.py` — generic Socrata client (Cook, LA, many more)
- `alembic/versions/` — schema migrations

## Operational rules

The non-negotiables (see `CLAUDE.md`):

- **1 req/sec max** to any single county domain. Always.
- Signals table is **append-only**. To deactivate, set `expires_at` — never UPDATE.
- Scoring weights live in `app/scoring/weights.py` and **are never served via any endpoint**.
- PACER credentials live in `.env` only. Never persisted to DB.
- Any new table needs a `GRANT … TO offmarketiq` block in its migration.
