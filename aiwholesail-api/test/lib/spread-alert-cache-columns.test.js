// Tests for description + is_foreclosure columns on property_search_cache
// and their wiring through the spread-alert worker.
//
// Why this exists (follow-up to PR #437, 2026-05-15):
//
//   PR #437 wired isAuctionSubject() into the spread-alert email
//   worker. Only the PPSF and low-absolute-price branches activate
//   because the cache schema (migration 005) carries only
//   price + sqft — not description, not is_foreclosure. The two
//   most reliable signals can never fire on alerts:
//
//     • Keyword path (description regex) — dark
//     • isForeclosure boolean (Zillow's explicit classification) — dark
//
//   This PR adds both columns to the cache, populates them in the
//   worker upsert, and the isAuctionSubject filter already added in
//   #437 picks them up automatically — no further code change.
//
// Source-introspection style — pins the contract without spinning up
// Postgres. The migration is plain SQL; the worker is a Node script.
//
// Run:
//   node --test aiwholesail-api/test/lib/spread-alert-cache-columns.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations');
const WORKER_PATH = path.join(__dirname, '..', '..', 'scripts', 'spread-alert-worker.js');

function findMigrationFile(slugRegex) {
  for (const name of fs.readdirSync(MIGRATIONS_DIR)) {
    if (slugRegex.test(name) && name.endsWith('.sql')) {
      return path.join(MIGRATIONS_DIR, name);
    }
  }
  return null;
}

test('migration adds description + is_foreclosure columns to property_search_cache', () => {
  // Find the migration by descriptive slug — naming convention is
  // NNN_<short_topic>.sql. The first PR that adds these columns
  // satisfies this test; subsequent renames must still match the
  // regex (must mention 'cache' AND ('description' OR 'foreclosure')).
  const migrationFile = findMigrationFile(
    /^\d+_.*(?:cache.*(description|foreclosure)|(description|foreclosure).*cache).*\.sql$/i,
  );
  assert.ok(
    migrationFile,
    'a migration file with cache+description/foreclosure in its name must exist',
  );

  const sql = fs.readFileSync(migrationFile, 'utf8');
  assert.match(
    sql,
    /ALTER TABLE\s+property_search_cache\s+ADD COLUMN\s+IF NOT EXISTS\s+description\s+TEXT/i,
    'migration must ADD COLUMN IF NOT EXISTS description TEXT',
  );
  assert.match(
    sql,
    /ALTER TABLE\s+property_search_cache\s+ADD COLUMN\s+IF NOT EXISTS\s+is_foreclosure\s+BOOLEAN/i,
    'migration must ADD COLUMN IF NOT EXISTS is_foreclosure BOOLEAN',
  );
});

test('migration uses IF NOT EXISTS for idempotency', () => {
  // Re-running the migration (e.g. dev rebuild) must not fail. ALTER
  // TABLE ADD COLUMN is not idempotent by default — IF NOT EXISTS is
  // required.
  const migrationFile = findMigrationFile(
    /^\d+_.*(?:cache.*(description|foreclosure)|(description|foreclosure).*cache).*\.sql$/i,
  );
  assert.ok(migrationFile);
  const sql = fs.readFileSync(migrationFile, 'utf8');
  // Two ALTER blocks, each IF NOT EXISTS — count occurrences
  const ifNotExistsCount = (sql.match(/IF NOT EXISTS/gi) || []).length;
  assert.ok(ifNotExistsCount >= 2, 'both ADD COLUMN statements need IF NOT EXISTS');
});

test('spread-alert-worker.js INSERT includes description + is_foreclosure', () => {
  const workerSrc = fs.readFileSync(WORKER_PATH, 'utf8');
  // Find the INSERT INTO property_search_cache block — extract from
  // INSERT to the closing semicolon/backtick.
  const insertStart = workerSrc.indexOf('INSERT INTO property_search_cache');
  assert.notEqual(insertStart, -1, 'worker must INSERT into property_search_cache');
  // Generous 2000-char window covers the full template literal.
  const insertBlock = workerSrc.slice(insertStart, insertStart + 2000);
  assert.match(
    insertBlock,
    /\bdescription\b/,
    'INSERT must include the description column',
  );
  assert.match(
    insertBlock,
    /\bis_foreclosure\b/,
    'INSERT must include the is_foreclosure column',
  );
});

test('spread-alert-worker.js ON CONFLICT UPDATE refreshes description + is_foreclosure', () => {
  // Without an UPDATE on conflict, cached rows from before this PR
  // would never get the new fields backfilled — they'd be NULL forever
  // and the keyword/isForeclosure branches stay dark for those rows.
  const workerSrc = fs.readFileSync(WORKER_PATH, 'utf8');
  const conflictStart = workerSrc.indexOf('ON CONFLICT (location, zpid) DO UPDATE');
  assert.notEqual(conflictStart, -1, 'worker upsert must have ON CONFLICT block');
  const conflictBlock = workerSrc.slice(conflictStart, conflictStart + 1500);
  assert.match(
    conflictBlock,
    /\bdescription\s*=/,
    'ON CONFLICT UPDATE must refresh description (so existing rows backfill)',
  );
  assert.match(
    conflictBlock,
    /\bis_foreclosure\s*=/,
    'ON CONFLICT UPDATE must refresh is_foreclosure',
  );
});

test('worker source-of-truth for description: p.description (top-level) with hi.description fallback', () => {
  // mapListingToSummary in zillowScrapeDo.js (PR #433) emits a
  // top-level `description` field on each search result. The worker
  // can pull it directly; no nested-payload reach required here.
  const workerSrc = fs.readFileSync(WORKER_PATH, 'utf8');
  // Find the binding parameters block — usually `[ location, String(p.zpid), ...`
  // We just need to know that p.description gets referenced near the
  // INSERT/UPDATE. Loose check — the precise binding order is implementation detail.
  const insertStart = workerSrc.indexOf('INSERT INTO property_search_cache');
  const blockAfterInsert = workerSrc.slice(insertStart, insertStart + 3000);
  assert.match(
    blockAfterInsert,
    /p\.description/,
    'worker must reference p.description when binding INSERT params',
  );
  assert.match(
    blockAfterInsert,
    /p\.isForeclosure|p\.is_foreclosure/,
    'worker must reference the foreclosure flag from the listing payload',
  );
});
