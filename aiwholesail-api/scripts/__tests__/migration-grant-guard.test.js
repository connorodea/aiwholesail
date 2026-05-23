// Tests for the migration-grant guard.
//
// Why this exists (recurring P0 prod bug):
//
//   AIWholesail's prod DB grants `aiwholesail` role only the permissions
//   it needs. Migrations that `CREATE TABLE foo` without a matching
//   `GRANT ... ON foo TO aiwholesail;` block silently 500 the live API
//   the moment any handler reads or writes that table — the error reads
//   "permission denied for table foo". This has bitten us at least 3
//   times (PR #131, PR #341, PR #346 caught in review).
//
//   The guard is a pure function that scans migration SQL and returns
//   an issues array. CI runs it across every file in
//   `aiwholesail-api/migrations/` and fails the build when any issue
//   surfaces. Catches the regression at PR time, not in prod.
//
//   Pure JS / ESM so the tests run under `node --test` without a
//   transpiler. Pattern mirrors auth-coherence.js (PR #415),
//   auction-detection.js (#408), comps-similarity.js (#371).
//
// Run:
//   node --test aiwholesail-api/scripts/__tests__/migration-grant-guard.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const { auditMigrationGrants } = require('../migration-grant-guard.js');

test('pure INSERT migration has no issues', () => {
  // E.g., 026_organic_loaders_flag.sql — only inserts into existing
  // feature_flag_globals + feature_flag_users tables. No new tables,
  // no GRANTs needed.
  const sql = `
    INSERT INTO feature_flag_globals (slug, enabled) VALUES ('foo', false);
    INSERT INTO feature_flag_users (user_id, slug, enabled)
      SELECT id, 'foo', true FROM users WHERE email = 'a@b.com';
  `;
  assert.deepEqual(auditMigrationGrants(sql, '026_test.sql'), []);
});

test('CREATE TABLE with matching GRANT block has no issues', () => {
  const sql = `
    CREATE TABLE foo (id SERIAL PRIMARY KEY, name TEXT);
    GRANT SELECT, INSERT, UPDATE, DELETE ON foo TO aiwholesail;
  `;
  assert.deepEqual(auditMigrationGrants(sql, '030_test.sql'), []);
});

test('CREATE TABLE without GRANT is flagged', () => {
  const sql = `CREATE TABLE bar (id SERIAL PRIMARY KEY, name TEXT);`;
  const issues = auditMigrationGrants(sql, '031_test.sql');
  assert.equal(issues.length, 1, 'one missing-grant issue');
  assert.equal(issues[0].file, '031_test.sql');
  assert.equal(issues[0].table, 'bar');
  assert.match(issues[0].message, /GRANT.*aiwholesail/i);
});

test('CREATE TABLE IF NOT EXISTS still requires a GRANT', () => {
  // Common pattern — re-runnable migrations use IF NOT EXISTS to be
  // idempotent. Still creates the table on first run; GRANT is mandatory.
  const sql = `CREATE TABLE IF NOT EXISTS baz (id SERIAL PRIMARY KEY);`;
  const issues = auditMigrationGrants(sql, '032_test.sql');
  assert.equal(issues.length, 1);
  assert.equal(issues[0].table, 'baz');
});

test('multiple CREATE TABLE with only one missing GRANT — only the missing one is flagged', () => {
  // The killer scenario for PR #346: migration creates several tables,
  // GRANTs some but forgets others. We must surface the SPECIFIC missing
  // table name, not just "this migration has issues."
  const sql = `
    CREATE TABLE alpha (id SERIAL PRIMARY KEY);
    GRANT SELECT, INSERT, UPDATE, DELETE ON alpha TO aiwholesail;

    CREATE TABLE beta (id SERIAL PRIMARY KEY);
    -- Forgot to GRANT on beta

    CREATE TABLE gamma (id SERIAL PRIMARY KEY);
    GRANT SELECT, INSERT, UPDATE, DELETE ON gamma TO aiwholesail;
  `;
  const issues = auditMigrationGrants(sql, '033_test.sql');
  assert.equal(issues.length, 1, 'only beta is missing');
  assert.equal(issues[0].table, 'beta');
});

test('commented-out CREATE TABLE is ignored', () => {
  // Migration files often have plan-text headers describing past
  // CREATE-TABLE work in other migrations. Single-line comments must
  // not trigger false positives.
  const sql = `
    -- CREATE TABLE in 011 already; this migration only adds an index
    -- CREATE TABLE legacy_user_sessions (...)
    CREATE INDEX users_email_idx ON users (email);
  `;
  assert.deepEqual(auditMigrationGrants(sql, '034_test.sql'), []);
});

test('GRANT to a different role does NOT satisfy the requirement', () => {
  // PR #131's real-world variant: GRANT to a role that does NOT exist
  // in production (e.g., a dev-only role). The aiwholesail role is the
  // one prod cares about; nothing else counts.
  const sql = `
    CREATE TABLE secret_thing (id SERIAL PRIMARY KEY);
    GRANT SELECT ON secret_thing TO some_other_role;
  `;
  const issues = auditMigrationGrants(sql, '035_test.sql');
  assert.equal(issues.length, 1);
  assert.equal(issues[0].table, 'secret_thing');
});

test('GRANT must include at least SELECT, INSERT, UPDATE, DELETE on the table', () => {
  // SELECT-only is a common mistake when the migration author thought
  // the table was read-only. If the table backs anything user-mutating
  // (alerts, leads, campaigns), this 500s on first write.
  // Currently the guard requires the full quartet; a future iteration
  // could allow read-only tables via a comment opt-in.
  const sql = `
    CREATE TABLE read_only_logs (id SERIAL PRIMARY KEY);
    GRANT SELECT ON read_only_logs TO aiwholesail;
  `;
  const issues = auditMigrationGrants(sql, '036_test.sql');
  assert.equal(issues.length, 1, 'partial GRANT is not enough');
  assert.match(issues[0].message, /INSERT/i);
});

test('CREATE TABLE with schema prefix (public.foo) is recognized', () => {
  // Some migrations use schema-qualified names. The guard must match
  // the table-name portion regardless of schema prefix.
  const sql = `
    CREATE TABLE public.tenants (id SERIAL PRIMARY KEY);
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO aiwholesail;
  `;
  assert.deepEqual(auditMigrationGrants(sql, '037_test.sql'), []);
});

test('case-insensitive matching — CREATE TABLE / create table / Create Table', () => {
  const sql = `
    create table foo (id serial primary key);
    Grant Select, Insert, Update, Delete On foo To aiwholesail;
  `;
  assert.deepEqual(auditMigrationGrants(sql, '038_test.sql'), []);
});

test('CREATE SEQUENCE requires a separate GRANT USAGE block', () => {
  // PostgreSQL sequences (SERIAL/BIGSERIAL auto-create) need
  // GRANT USAGE, SELECT to insert rows. Without it, inserts fail with
  // "permission denied for sequence". Same class as the table GRANTs.
  // Currently the guard flags explicit CREATE SEQUENCE; implicit
  // sequences via SERIAL are out of scope (covered by the parent
  // table's GRANT block).
  const sql = `CREATE SEQUENCE my_seq START 1000;`;
  const issues = auditMigrationGrants(sql, '039_test.sql');
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /sequence/i);
});

test('returns issues with consistent shape: {file, table, message}', () => {
  const sql = `CREATE TABLE qux (id SERIAL PRIMARY KEY);`;
  const issues = auditMigrationGrants(sql, '040_test.sql');
  assert.equal(issues.length, 1);
  assert.equal(typeof issues[0].file, 'string');
  assert.equal(typeof issues[0].table, 'string');
  assert.equal(typeof issues[0].message, 'string');
});

test('empty input does not crash', () => {
  assert.deepEqual(auditMigrationGrants('', 'empty.sql'), []);
  assert.deepEqual(auditMigrationGrants(null, 'null.sql'), []);
  assert.deepEqual(auditMigrationGrants(undefined, 'undef.sql'), []);
});

const { auditMigrationsDirectory } = require('../migration-grant-guard.js');

test('directory audit: CREATE TABLE in file A + GRANT in file B is satisfied', () => {
  // Legacy pattern in this repo: 013_llm_token_ledger.sql creates the
  // table, 019_llm_token_ledger_grant.sql adds the GRANT block as a
  // follow-up. Both files together = no issue. The per-file audit flags
  // 013 in isolation; the directory audit must reconcile across files.
  const filesByName = {
    '013_thing.sql': `CREATE TABLE thing (id SERIAL PRIMARY KEY);`,
    '019_thing_grant.sql':
      `GRANT SELECT, INSERT, UPDATE, DELETE ON thing TO aiwholesail;`,
  };
  assert.deepEqual(auditMigrationsDirectory(filesByName), []);
});

test('directory audit: CREATE TABLE with no GRANT anywhere is still flagged', () => {
  const filesByName = {
    '040_test.sql': `CREATE TABLE orphan (id SERIAL PRIMARY KEY);`,
    '041_other.sql': `INSERT INTO orphan (id) VALUES (1);`,
  };
  const issues = auditMigrationsDirectory(filesByName);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].table, 'orphan');
  assert.equal(issues[0].file, '040_test.sql');
});

test('directory audit: GRANT in an EARLIER file does not satisfy a LATER CREATE TABLE', () => {
  // GRANT must reference a table that already exists OR will exist.
  // PostgreSQL allows GRANT-then-CREATE in some scenarios via a re-run,
  // but our migrate runner processes files in order. A GRANT before
  // the table is created is a no-op error at apply time — flag it.
  const filesByName = {
    '050_grant_first.sql':
      `GRANT SELECT, INSERT, UPDATE, DELETE ON late_table TO aiwholesail;`,
    '051_table.sql': `CREATE TABLE late_table (id SERIAL PRIMARY KEY);`,
  };
  const issues = auditMigrationsDirectory(filesByName);
  assert.equal(issues.length, 1, 'GRANT must follow the CREATE TABLE');
  assert.equal(issues[0].table, 'late_table');
});

test('directory audit: empty input does not crash', () => {
  assert.deepEqual(auditMigrationsDirectory({}), []);
  assert.deepEqual(auditMigrationsDirectory(null), []);
  assert.deepEqual(auditMigrationsDirectory(undefined), []);
});

const { diffAgainstBaseline } = require('../migration-grant-guard.js');

test('baseline diff: issue present in baseline is suppressed', () => {
  // Pre-existing legacy gap (e.g. `auth_zombie_events` partial GRANT)
  // that prod tolerates via role-level permissions we set up manually.
  // The baseline carries it so CI doesn't block every new PR until
  // the legacy migration is patched.
  const current = [{ file: '022.sql', table: 'auth_zombie_events', message: '...' }];
  const baseline = [{ file: '022.sql', table: 'auth_zombie_events' }];
  assert.deepEqual(diffAgainstBaseline(current, baseline), {
    newIssues: [],
    fixed: [],
  });
});

test('baseline diff: NEW issue not in baseline is reported as a regression', () => {
  // This is the killer scenario: a fresh PR adds a CREATE TABLE without
  // a GRANT block. The current run produces an issue; the baseline does
  // NOT contain it; CI must fail.
  const current = [
    { file: '022.sql', table: 'auth_zombie_events', message: '...' },
    { file: '033_new.sql', table: 'campaigns', message: '...' },
  ];
  const baseline = [{ file: '022.sql', table: 'auth_zombie_events' }];
  const { newIssues, fixed } = diffAgainstBaseline(current, baseline);
  assert.equal(newIssues.length, 1);
  assert.equal(newIssues[0].table, 'campaigns');
  assert.deepEqual(fixed, []);
});

test('baseline diff: issue in baseline but not in current is reported as fixed', () => {
  // When a legacy table gets its missing GRANT added, the baseline is
  // stale. CI surfaces the "fixed" item so the reviewer knows to update
  // the baseline file in the same PR. Not a CI failure — informational.
  const current = [];
  const baseline = [
    { file: '022.sql', table: 'auth_zombie_events' },
    { file: '003.sql', table: 'buyers' },
  ];
  const { newIssues, fixed } = diffAgainstBaseline(current, baseline);
  assert.deepEqual(newIssues, []);
  assert.equal(fixed.length, 2);
});

test('baseline diff: match on (file, table) tuple — same table in different files is distinct', () => {
  const current = [{ file: '050.sql', table: 'foo', message: '...' }];
  const baseline = [{ file: '049.sql', table: 'foo' }];
  const { newIssues } = diffAgainstBaseline(current, baseline);
  assert.equal(newIssues.length, 1, 'different file = different issue');
});

test('baseline diff: defensive on null/undefined inputs', () => {
  assert.deepEqual(diffAgainstBaseline([], []), { newIssues: [], fixed: [] });
  assert.deepEqual(diffAgainstBaseline(null, null), { newIssues: [], fixed: [] });
  assert.deepEqual(
    diffAgainstBaseline(undefined, undefined),
    { newIssues: [], fixed: [] },
  );
});
