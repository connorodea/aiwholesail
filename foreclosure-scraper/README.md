# foreclosure-scraper

Modular public-record foreclosure data scraper for aiwholesail.com.

Collects NOD (Notice of Default), LP (Lis Pendens), NTS (Notice of Trustee Sale), and REO records from county recorder sites and court dockets. Stores normalized records in PostgreSQL and archives raw HTML snapshots to Cloudflare R2 for re-parsing.

## Architecture

```
Scheduler (cron, reads county_configs)
   │
   ▼
Bull Queue (Redis)  ──▶ Worker(s)
                          │
                          ▼
                       Adapter.scrape()  ──▶ raw HTML snapshot → R2
                          │
                          ▼
                       normalizeBatch()  ──▶ upsert → foreclosure_records
                          │
                          ▼
                    scrape_jobs (audit row per run)
```

Three concerns, three roles via `PROCESS_ROLE`:
- `scheduler` — cron only
- `worker` — queue worker + `/health`
- `all` — everything (default)

## Layout

```
src/
  index.ts                  # entrypoint (boots role)
  scheduler.ts              # cron, reads county_configs
  queue.ts                  # Bull queue + worker
  normalizer.ts             # raw → canonical mapping helpers
  health.ts                 # express /health + /health/deep
  config.ts                 # env validation
  logger.ts                 # pino
  adapters/
    _template.ts            # BaseAdapter — clone this for new counties
    maricopa-az.ts          # static HTML (cheerio) — proof-of-concept
    clark-nv.ts             # static HTML stub
    cook-il.ts              # playwright stub (judicial / LP)
    index.ts                # registry
  db/
    index.ts                # pg pool
    records.ts              # upsertRecords
    jobs.ts                 # scrape_jobs CRUD
    county-configs.ts       # listEnabledConfigs / findConfig
    migrations/001_foreclosure_schema.sql
  storage/r2.ts             # snapshot put/get
  lib/
    http.ts                 # politeGet (UA rotation, proxy, retry)
    browser.ts              # shared chromium for playwright adapters
    delay.ts                # sleep + jitter
  types/index.ts            # ScraperAdapter, ScrapeJob, ForeclosureRecord, …
scripts/
  migrate.ts                # apply SQL migrations
  backfill.ts               # enqueue a date-ranged backfill
  test-adapter.ts           # run one adapter in isolation, dump to stdout
```

## Setup

```bash
cp .env.example .env
# fill DATABASE_URL, REDIS_URL, R2_* (optional)
npm install
npx playwright install chromium   # only needed for cook-il
npm run migrate
```

## Run

```bash
npm run dev      # ts-node-dev, boots role from .env
npm run build && npm start
```

## Add a new county

1. Copy `src/adapters/_template.ts` to `{county}-{state}.ts`
2. Implement `scrape`, `getNextPage`, `normalize`
3. Register it in `src/adapters/index.ts`
4. Insert a row into `county_configs` (or create a migration if it's a long-term target)
5. Verify with `npm run test-adapter -- --adapter={name} --type=NOD --start=2026-04-01 --end=2026-04-30`
6. Flip `enabled = TRUE` on the county_configs row when you're happy

## Phase status

- Phase 1 (foundation) — done
- Phase 2 (maricopa-az) — wired end-to-end, selectors need live verification
- Phase 3 (scheduler + /health) — done
- Phase 4 (clark-nv, cook-il) — stubbed, selectors are placeholders. Run `test-adapter` and update `county_configs.config_json` with real selectors before enabling.

## Deployment

Target is Hetzner via the standard CI/CD setup (see `aiwholesail/README_DEPLOY.md`). Two systemd units recommended:

- `foreclosure-scraper-worker` (`PROCESS_ROLE=worker`)
- `foreclosure-scraper-scheduler` (`PROCESS_ROLE=scheduler`)

The worker exposes `/health` on `$PORT`. Wire Nginx → upstream and add to your existing healthcheck rotation.

## Notes

- Records are deduped on `(external_id, county, state, record_type)`. Re-runs are idempotent.
- The normalizer never throws — failures are counted and surfaced via `scrape_jobs.error`.
- R2 is optional; if creds aren't set, `snapshot_key` stays null and the pipeline still flows.
- Respect each county's `robots.txt`. Default rate limit is 2s with jitter; tune per-county via `county_configs.rate_limit_ms`.
