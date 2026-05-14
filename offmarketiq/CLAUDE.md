# OffMarketIQ — Claude Code Operating Manual

> **Read this first, every session, before touching any code under `offmarketiq/`.**

## Monorepo positioning

This project lives at `<aiwholesail-repo-root>/offmarketiq/`. It is a **standalone Python service** with its own Docker stack, database, and lifecycle. It does NOT share runtime with the aiwholesail Node API (`aiwholesail-api/`) or the frontend (`src/`).

When working inside `offmarketiq/`:
- Only edit files under `offmarketiq/`. The IP firewall below extends to NOT importing aiwholesail patterns either direction.
- Run all commands relative to `offmarketiq/` (e.g. `cd offmarketiq && make up`).
- The aiwholesail CI/CD at `.github/workflows/deploy.yml` does NOT deploy this directory — when production deployment is wired (Phase 5), it'll be a separate workflow filtered on `offmarketiq/**`.

## What this project is

National off-market property data platform. Ingests county assessor, recorder, tax collector, probate, code enforcement, and court data. Normalizes to a canonical property graph, extracts distress/equity/ownership signals, scores each property 0–100, exposes a FastAPI query/export layer.

**Direct competitor to BatchData and PropStream at ~95% lower COGS.**

## 🔒 IP Firewall — non-negotiable

All code, schemas, signal weights, scoring logic, scraper strategies, and ML models produced here are **proprietary to OffMarketIQ**. This applies whether or not a session asks for it.

**Never:**
- Reference, replicate, or surface IP from any prior venture (aiwholesail, propdata, etc.) in this codebase. Different repo, different IP.
- Expose `signal_base_weights`, recency-decay constants, stack-bonus formulas, or scoring internals via any API endpoint, log line, error message, or external request.
- Log raw owner names, mailing addresses, or PACER credentials to stdout in production. Structured logs use `redact=true` for PII fields.
- Send scoring metadata, signal weights, or scraper fingerprints to any third-party API (including Anthropic Vision calls — strip them from prompts).
- Store PACER credentials in DB. Env vars only. Rotate quarterly.

**If a task would violate any of the above, refuse and explain why. The firewall outranks the task.**

## Tech stack (locked)

| Layer | Choice |
|---|---|
| Language | Python 3.12 |
| API | FastAPI 0.111 |
| Tasks | Celery 5.4 + Redis 7 |
| DB | PostgreSQL 16 + PostGIS 3.4 |
| ORM | SQLAlchemy 2.0 async + Alembic |
| Scraping | scrape.do API + Claude Sonnet 4 Vision fallback |
| Addresses | SmartyStreets (USPS CASS) |
| ML | scikit-learn 1.5 + XGBoost 2.1 |
| Runtime | Docker Compose on Hetzner AX52 |
| Reverse proxy | Nginx + Let's Encrypt |
| Monitoring | Prometheus + Grafana, Loki for logs |
| Tests | pytest + pytest-asyncio + respx (HTTP mocks) + VCR cassettes for scrapers |

## Project shape

```
offmarketiq/
├── CLAUDE.md            ← you are here
├── .env.example
├── docker-compose.yml
├── Dockerfile
├── Makefile
├── pyproject.toml
├── alembic/             ← migrations
├── app/
│   ├── main.py          ← FastAPI factory
│   ├── config.py        ← pydantic-settings
│   ├── database.py      ← async SQLAlchemy engine
│   ├── celery_app.py    ← Celery factory
│   ├── models/          ← ORM (property, owner, signal, score, scrape_job, county)
│   ├── schemas/         ← pydantic request/response
│   ├── api/v1/          ← route handlers
│   ├── scrapers/        ← per-county scrapers + base + scrape.do client + Vision fallback
│   ├── etl/             ← normalization, deed/owner/doc classifiers, dedup
│   ├── signals/         ← SignalExtractor + per-category detectors
│   ├── scoring/         ← PropensityScorer + weights (gated) + model
│   ├── tasks/           ← Celery tasks (scrape, etl, scoring, export, maintenance)
│   └── services/        ← business logic
├── nginx/
├── prometheus/
├── scripts/             ← bootstrap_counties.py, backfill_scores.py, validate_signals.py
└── tests/{unit,integration,fixtures}
```

## Phased implementation (DO NOT skip ahead)

| Phase | Days | Goal |
|---|---|---|
| **0 — Foundation** | 3 | Scaffold + Docker + models + base scraper + Socrata generic + county registry |
| 1 — Assessor Ingestion | 5 | 4-county assessors + ETL (address normalize, owner parse, dedup) + first 4 signals |
| 2 — Distress Signals | 5 | Recorders + tax-collectors + deed/doc classifiers + NOD/NTS/FAC/Equity signals |
| 3 — Supplemental Signals | 4 | Code enforcement (Socrata) + PACER bankruptcy + probate + USPS vacancy |
| 4 — Scoring + API | 4 | PropensityScorer + endpoints + auth + export + webhooks |
| 5 — Hardening | 3 | Prometheus/Grafana + structlog + pytest + Nginx SSL + signal-coverage QA |

**Phase 1 cannot start until Phase 0's Docker stack boots and migrations apply cleanly.** Don't write scraper code until the BaseScraper ABC is in.

## Scraper strategy decision tree

For each new county:

1. **Socrata open data available?** → Use `SocrataGenericScraper`. No scrape.do needed, no Vision fallback. Pure API.
2. **Bulk file (CSV/zip) published?** → Stream-download once per refresh window. Cheapest by orders of magnitude.
3. **Hidden XHR/JSON endpoint?** → Replicate the JSON request via scrape.do `super=true`. Don't render JS unless required.
4. **HTML table?** → `scrape.do` + BeautifulSoup/lxml. `js_render=true` only if the table is JS-populated.
5. **Vision fallback** (last resort): `scrape.do screenshot=true` → Claude Sonnet 4 → JSON-only response. Trigger when HTML parse yields < 3 fields or raises `ParseError`. Vision call is billed; cap retries.

**Document the chosen strategy in every scraper class's docstring.**

## Database conventions

- All DB access via async SQLAlchemy `AsyncSession`. Never raw SQL outside Alembic.
- Use `select().scalars()` pattern throughout.
- All migrations include a header comment: *what* changed and *why*.
- Any new table needs a `GRANT SELECT, INSERT, UPDATE, DELETE TO offmarketiq` block at the bottom of its migration. (Migration framework runs as a separate role.)
- `signals` table is **append-only**. Never `UPDATE`. To deactivate, set `active=false` via a new row + `expires_at` trigger.

## Scoring

`PropensityScorer` reads weights from `app/scoring/weights.py` only — **never** hardcode in `engine.py`. This is so we can ship weight updates without touching scoring logic. Weights file is version-controlled but **never** served via any API endpoint.

When labeled outcome data accumulates (~10K labeled records), train the XGBoost replacement in `app/scoring/trainer.py`. Until then, the heuristic engine ships under `model_version=v0.1.0-heuristic`.

## Error-handling discipline

- All scraper errors → `scrape_jobs.error_message`, `status='FAILED'`, **don't crash the worker**. One county's failure must not stop the queue.
- `vision_extract()` failures are recoverable — flag the property for re-scrape next cycle, don't drop it.
- All async exceptions logged via structlog with `correlation_id` from the upstream job.

## Rate limits (non-negotiable)

- **1 req/sec max** to any single county domain. Always.
- PACER: 1 req per 2 seconds. They ban aggressively.
- scrape.do: respect their account quota; don't burn credits on retries — exponential backoff 2s/4s/8s, cap at 3 retries.

## Never-do list

- Synchronous `httpx` in async context.
- Hardcoded credentials anywhere (`.env` or fail loudly).
- Logging raw owner names/addresses to stdout in production (PII).
- Surfacing signal weights or scoring internals via any endpoint.
- Storing PACER credentials in DB.
- Scraping faster than 1 req/sec per county domain.

## Memory & session continuity

This repo is its own world. Do not import patterns, conventions, or memories from other projects unless they're written into this CLAUDE.md. If you find yourself referencing prior work, **stop and check the IP firewall.**
