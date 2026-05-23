#!/usr/bin/env node
/**
 * Sweep expired rows out of `scrape_response_cache`.
 *
 * Invocation (no args):
 *   node scripts/sweep-scrape-cache.js
 *
 * Intended to run on a cron (e.g. hourly via systemd timer). Exits 0 on
 * success after logging how many rows it removed, non-zero on DB error
 * so the cron alerts. See migration 018 for the table schema and
 * lib/scrapers/scrapeDoCache.js for the wrapper this cache backs.
 */

require('dotenv').config();
const { deleteExpired } = require('../lib/scrapers/scrapeDoCache');

(async () => {
  const start = Date.now();
  try {
    const removed = await deleteExpired();
    console.log(
      `[sweep-scrape-cache] removed ${removed} expired row(s) in ${Date.now() - start}ms`
    );
    process.exit(0);
  } catch (err) {
    console.error('[sweep-scrape-cache] failed:', err.message);
    process.exit(1);
  }
})();
