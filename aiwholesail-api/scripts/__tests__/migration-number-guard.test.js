// Tests for the migration-number collision guard.
//
// Why this exists (recurring P0):
//
//   Two migrations claim the same numeric prefix (e.g. PR #341 + PR #346
//   both shipped `022_email_suppression_and_replies.sql` while
//   `022_auth_zombie_events.sql` already existed on main). The migrate
//   runner processes files in lexicographic order, so a duplicate prefix
//   means one of the two SQL files will be silently skipped depending on
//   filename suffix ordering — the table never gets created in prod, the
//   API 500s on first access, and the symptom looks identical to the
//   missing-GRANT class (P0).
//
//   This guard scans the migrations directory at PR time, groups files
//   by their leading numeric prefix, and fails CI if any prefix has more
//   than one file.
//
//   Pure JS / ESM so the tests run under `node --test`. Same pattern as
//   migration-grant-guard.js (same PR).
//
// Run:
//   node --test aiwholesail-api/scripts/__tests__/migration-number-guard.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  auditMigrationNumbers,
  extractMigrationNumber,
} = require('../migration-number-guard.js');

test('extractMigrationNumber: parses standard NNN_name.sql', () => {
  assert.equal(extractMigrationNumber('022_auth_zombie_events.sql'), 22);
  assert.equal(extractMigrationNumber('001_initial_schema.sql'), 1);
  assert.equal(extractMigrationNumber('030_rapidapi_request_metrics.sql'), 30);
});

test('extractMigrationNumber: tolerates 4-digit prefixes', () => {
  // Future-proofing — once we cross 1000 migrations (we won't, but
  // the parse should not be locked to 3 digits).
  assert.equal(extractMigrationNumber('1001_future.sql'), 1001);
});

test('extractMigrationNumber: returns null for files without a numeric prefix', () => {
  // README, helper scripts, .gitkeep — anything in the migrations dir
  // that isn't a numbered migration. The guard ignores these.
  assert.equal(extractMigrationNumber('README.md'), null);
  assert.equal(extractMigrationNumber('migrate.js'), null);
  assert.equal(extractMigrationNumber('_helpers.sql'), null);
});

test('extractMigrationNumber: returns null for non-SQL files even when numeric', () => {
  // Only .sql files count — a `030_metrics.md` doc would otherwise
  // collide with `030_metrics.sql` and break the guard.
  assert.equal(extractMigrationNumber('030_metrics.md'), null);
  assert.equal(extractMigrationNumber('030_metrics.txt'), null);
});

test('auditMigrationNumbers: returns no issues when every prefix is unique', () => {
  const filenames = [
    '001_initial.sql',
    '002_buyers.sql',
    '003_sequences.sql',
  ];
  assert.deepEqual(auditMigrationNumbers(filenames), []);
});

test('auditMigrationNumbers: flags a duplicate prefix with both filenames', () => {
  // The killer scenario from PR #346: two files both prefixed 022_.
  // The issue must name BOTH so the reviewer can decide which renames.
  const filenames = [
    '001_initial.sql',
    '022_auth_zombie_events.sql',
    '022_email_suppression_and_replies.sql',
  ];
  const issues = auditMigrationNumbers(filenames);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].number, 22);
  assert.deepEqual(
    [...issues[0].files].sort(),
    ['022_auth_zombie_events.sql', '022_email_suppression_and_replies.sql'].sort(),
  );
  assert.match(issues[0].message, /collid|duplicate|prefix/i);
});

test('auditMigrationNumbers: flags three-way collisions with all filenames', () => {
  // Defensive: a worst-case rebase from three stacked branches could
  // produce three files at the same prefix. Make sure none are lost.
  const filenames = [
    '022_a.sql',
    '022_b.sql',
    '022_c.sql',
  ];
  const issues = auditMigrationNumbers(filenames);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].files.length, 3);
});

test('auditMigrationNumbers: pre-existing collision in repo (021_*) is flagged too', () => {
  // The current repo state already has `021_deprecate_zillow_scrape_do_flag.sql`
  // and `021_monitor_alerts.sql` from a parallel-agent rebase oversight.
  // The guard MUST flag this so future PRs don't add a third 021_*.
  const filenames = [
    '021_deprecate_zillow_scrape_do_flag.sql',
    '021_monitor_alerts.sql',
    '022_auth_zombie_events.sql',
  ];
  const issues = auditMigrationNumbers(filenames);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].number, 21);
});

test('auditMigrationNumbers: ignores non-migration files in the same directory', () => {
  // README, package.json, .gitkeep, etc. should not contribute.
  const filenames = [
    'README.md',
    '001_initial.sql',
    '_seed.sql',  // no numeric prefix
    '030_rapidapi.sql',
  ];
  assert.deepEqual(auditMigrationNumbers(filenames), []);
});

test('auditMigrationNumbers: multiple collisions all reported', () => {
  const filenames = [
    '022_a.sql', '022_b.sql',
    '030_x.sql', '030_y.sql',
  ];
  const issues = auditMigrationNumbers(filenames);
  assert.equal(issues.length, 2);
  const numbers = issues.map((i) => i.number).sort();
  assert.deepEqual(numbers, [22, 30]);
});

test('auditMigrationNumbers: defensive on null/undefined/empty', () => {
  assert.deepEqual(auditMigrationNumbers([]), []);
  assert.deepEqual(auditMigrationNumbers(null), []);
  assert.deepEqual(auditMigrationNumbers(undefined), []);
});

test('issue shape: {number, files, message} consistent across runs', () => {
  const issues = auditMigrationNumbers(['022_a.sql', '022_b.sql']);
  assert.equal(issues.length, 1);
  assert.equal(typeof issues[0].number, 'number');
  assert.equal(Array.isArray(issues[0].files), true);
  assert.equal(typeof issues[0].message, 'string');
});

const { diffNumbersAgainstBaseline } = require('../migration-number-guard.js');

test('diffNumbersAgainstBaseline: legacy collision is suppressed', () => {
  // 014 + 021 are pre-existing legacy collisions on main. Baseline
  // suppresses them so the guard only fails on NEW collisions.
  const current = [{ number: 21, files: ['021_a.sql', '021_b.sql'] }];
  const baseline = [{ number: 21, files: ['021_a.sql', '021_b.sql'] }];
  assert.deepEqual(
    diffNumbersAgainstBaseline(current, baseline),
    { newIssues: [], resolved: [] },
  );
});

test('diffNumbersAgainstBaseline: NEW collision not in baseline is flagged', () => {
  // The killer scenario: PR introduces a third file at number 022
  // (e.g. PR #346 + #341 both shipping 022_*).
  const current = [
    { number: 21, files: ['021_a.sql', '021_b.sql'] },
    { number: 22, files: ['022_x.sql', '022_y.sql'] },
  ];
  const baseline = [{ number: 21, files: ['021_a.sql', '021_b.sql'] }];
  const { newIssues } = diffNumbersAgainstBaseline(current, baseline);
  assert.equal(newIssues.length, 1);
  assert.equal(newIssues[0].number, 22);
});

test('diffNumbersAgainstBaseline: legacy collision GROWS (3rd file added) — flagged as new', () => {
  // Subtle but important: if a baseline collision goes from 2 files to
  // 3 files, the third file is a regression. Same `number` is in
  // baseline, but the file list grew — flag it.
  const current = [
    { number: 21, files: ['021_a.sql', '021_b.sql', '021_NEW.sql'] },
  ];
  const baseline = [{ number: 21, files: ['021_a.sql', '021_b.sql'] }];
  const { newIssues } = diffNumbersAgainstBaseline(current, baseline);
  assert.equal(newIssues.length, 1, 'growing collision is a regression');
  assert.match(newIssues[0].message, /grew|added/i);
});

test('diffNumbersAgainstBaseline: legacy collision is resolved → "resolved" list', () => {
  // When a legacy collision gets fixed (renumbered), the baseline is
  // stale. CI surfaces "resolved" so the reviewer updates the baseline.
  const current = [];
  const baseline = [
    { number: 14, files: ['014_a.sql', '014_b.sql'] },
    { number: 21, files: ['021_a.sql', '021_b.sql'] },
  ];
  const { newIssues, resolved } = diffNumbersAgainstBaseline(current, baseline);
  assert.deepEqual(newIssues, []);
  assert.equal(resolved.length, 2);
});

test('diffNumbersAgainstBaseline: defensive on null/undefined', () => {
  assert.deepEqual(
    diffNumbersAgainstBaseline(null, null),
    { newIssues: [], resolved: [] },
  );
  assert.deepEqual(
    diffNumbersAgainstBaseline([], []),
    { newIssues: [], resolved: [] },
  );
});
