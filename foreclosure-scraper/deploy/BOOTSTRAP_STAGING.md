# Staging VPS Bootstrap — one-time

Run **once** on `hetznerCO` before the first deploy. After this, GitHub Actions
handles every subsequent deploy automatically.

All commands assume you're SSH'd to the box as a user with `sudo`:

```bash
ssh hetznerCO
```

## 1. Create the app dir

```bash
sudo mkdir -p /var/www/foreclosure-scraper-staging
sudo chown -R "$USER":"$USER" /var/www/foreclosure-scraper-staging
```

## 2. Write the `.env`

Copy the staging Postgres password from the existing API staging unit:

```bash
sudo grep -E '^DATABASE_URL' /var/www/aiwholesail-api-staging/.env
# Use the password from that DATABASE_URL.
```

Create `/var/www/foreclosure-scraper-staging/.env` using
`deploy/.env.staging.template` as the template. **Fill in the password.**

```bash
sudo install -m 600 /dev/stdin /var/www/foreclosure-scraper-staging/.env <<'EOF'
DATABASE_URL=postgres://aiwholesail_staging:<PASSWORD>@localhost:5432/aiwholesail_staging
REDIS_URL=redis://localhost:6379/2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=foreclosure-snapshots-staging
PROXY_URL=
QUEUE_CONCURRENCY=2
MAX_PAGES_PER_RUN=5
DEFAULT_RATE_LIMIT_MS=3000
PORT=3204
LOG_LEVEL=info
LOG_PRETTY=false
EOF
```

## 3. Install systemd units

The unit files are deployed to `/var/www/foreclosure-scraper-staging/deploy/`
by CI on every push. For the first install, symlink them into systemd:

```bash
sudo ln -sf /var/www/foreclosure-scraper-staging/deploy/foreclosure-scraper-worker-staging.service /etc/systemd/system/foreclosure-scraper-worker-staging.service
sudo ln -sf /var/www/foreclosure-scraper-staging/deploy/foreclosure-scraper-scheduler-staging.service /etc/systemd/system/foreclosure-scraper-scheduler-staging.service
sudo systemctl daemon-reload
```

> Note: CI will not have populated `/var/www/foreclosure-scraper-staging/deploy/`
> yet on first run. Either (a) run the symlinks *after* the first CI push that
> rsyncs the deploy/ files, or (b) `sudo cp deploy/*.service /etc/systemd/system/`
> manually as a one-shot.

## 4. Run migrations (first time only)

Migrations are idempotent; running them at bootstrap creates the three tables
plus seeds three disabled adapters (Maricopa AZ / Clark NV / Cook IL):

```bash
cd /var/www/foreclosure-scraper-staging
# (after the first rsync deploys the code + node_modules)
npm run migrate
```

Verify:

```bash
sudo -u postgres psql -d aiwholesail_staging -c \
  "SELECT county, state, adapter_name, enabled FROM county_configs ORDER BY state, county;"
```

Expected: 3 rows, all `enabled = f`.

## 5. Enable + start the units

```bash
sudo systemctl enable --now foreclosure-scraper-worker-staging
sudo systemctl enable --now foreclosure-scraper-scheduler-staging
sudo systemctl status foreclosure-scraper-worker-staging --no-pager | head -10
```

## 6. Smoke test

```bash
curl -sf http://localhost:3204/health
# {"status":"ok"}

curl -sf http://localhost:3204/health/deep
# {"status":"ok","queue":{"waiting":0,"active":0,...},"recentJobs":{}}
```

`journalctl -u foreclosure-scraper-worker-staging -n 50 --no-pager` should
show clean boot logs (no errors) and `scrape worker started`.

## 7. Sanity-test the cron registration (no actual scraping)

The scheduler reads enabled county_configs at boot. With all three rows
`enabled = false`, you should see:

```
journalctl -u foreclosure-scraper-scheduler-staging | grep "no enabled county_configs"
```

This proves the scheduler booted, queried the DB, and correctly found
nothing to schedule. **Do not flip any adapter to `enabled = true` on
staging until the live selectors have been verified end-to-end via
`scripts/test-adapter.ts`.**

## Rollback

If anything goes wrong:

```bash
sudo systemctl stop foreclosure-scraper-worker-staging foreclosure-scraper-scheduler-staging
sudo systemctl disable foreclosure-scraper-worker-staging foreclosure-scraper-scheduler-staging
# Tables are isolated — safe to leave in place, or drop:
# sudo -u postgres psql -d aiwholesail_staging -c "DROP TABLE foreclosure_records, scrape_jobs, county_configs, foreclosure_scraper_migrations CASCADE;"
```

The existing staging API (port 3203) is unaffected — these units use a
separate Redis DB index, a separate DB schema (new tables only), and a
separate port. No shared state.
