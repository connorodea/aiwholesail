// Migration GRANT guard.
//
// Pure function `auditMigrationGrants(sql, filename)` that scans a single
// migration SQL file and returns an array of issues — one per
// CREATE TABLE / CREATE SEQUENCE that lacks the matching GRANT block
// for the `aiwholesail` role.
//
// Catches the recurring P0 prod bug: a new table ships to prod without
// a `GRANT SELECT, INSERT, UPDATE, DELETE ON foo TO aiwholesail;` block,
// the live API 500s with "permission denied for table foo" on the next
// read or write, and we find out from a user report. Real incidents:
// PR #131, PR #341 (caught in review), PR #346 (caught in review).
//
// The accompanying CLI wrapper (scripts/check-migration-grants.mjs)
// reads every file under aiwholesail-api/migrations/ and reports all
// issues with a non-zero exit code if any are found. Wired into the
// `Library unit tests` CI step.

'use strict';

const CREATE_TABLE_RE = /^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:[\w]+)\.)?(["\w]+)/gim;
const CREATE_SEQUENCE_RE = /^\s*CREATE\s+SEQUENCE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:[\w]+)\.)?(["\w]+)/gim;
const REQUIRED_PRIVS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

/**
 * Strip single-line `--` SQL comments so they don't trigger false
 * positives in CREATE-TABLE detection. Block comments (slash-star)
 * are rare in this repo; not currently handled.
 *
 * @param {string} sql
 * @returns {string}
 */
function stripLineComments(sql) {
  return sql
    .split(/\r?\n/)
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}

/**
 * Does the SQL contain a GRANT with all four required privileges on
 * `table` for the `aiwholesail` role? Tolerates spaces, newlines,
 * comma-separated privileges in any order, schema-qualified target.
 *
 * @param {string} sql - migration SQL with line comments already stripped
 * @param {string} table - table identifier (e.g. "foo" or "public.foo")
 * @returns {{ok: boolean, missingPrivs: string[]}}
 */
function hasFullGrant(sql, table) {
  const bare = table.replace(/^[\w]+\./, '');
  const grantBlocks = sql.match(/GRANT\s+[\s\S]*?\s+ON\s+(?:[\w]+\.)?[\w"]+\s+TO\s+\w+\s*;/gi) || [];

  for (const block of grantBlocks) {
    if (!/\bTO\s+aiwholesail\b/i.test(block)) continue;
    const onMatch = block.match(/ON\s+(?:[\w]+\.)?(["\w]+)/i);
    if (!onMatch) continue;
    const targetBare = onMatch[1].replace(/"/g, '');
    if (targetBare.toLowerCase() !== bare.toLowerCase()) continue;

    const privsPart = block.replace(/^GRANT\s+/i, '').split(/\s+ON\s+/i)[0];
    const privs = privsPart.split(/[,\s]+/).map((p) => p.toUpperCase()).filter(Boolean);
    const missing = REQUIRED_PRIVS.filter((p) => !privs.includes(p));
    if (missing.length === 0) {
      return { ok: true, missingPrivs: [] };
    }
    return { ok: false, missingPrivs: missing };
  }

  return { ok: false, missingPrivs: REQUIRED_PRIVS };
}

/**
 * Does the SQL contain a `GRANT USAGE` (or USAGE + SELECT) on `seq`
 * for the aiwholesail role?
 *
 * @param {string} sql
 * @param {string} seq
 * @returns {boolean}
 */
function hasSequenceGrant(sql, seq) {
  const bare = seq.replace(/^[\w]+\./, '');
  const grantBlocks = sql.match(/GRANT\s+[\s\S]*?\s+ON\s+SEQUENCE\s+(?:[\w]+\.)?[\w"]+\s+TO\s+\w+\s*;/gi) || [];
  for (const block of grantBlocks) {
    if (!/\bTO\s+aiwholesail\b/i.test(block)) continue;
    const onMatch = block.match(/ON\s+SEQUENCE\s+(?:[\w]+\.)?(["\w]+)/i);
    if (!onMatch) continue;
    const targetBare = onMatch[1].replace(/"/g, '');
    if (targetBare.toLowerCase() === bare.toLowerCase()) return true;
  }
  return false;
}

/**
 * Audit one migration SQL string and return an array of issue objects.
 * Empty array means the migration is clean.
 *
 * Each issue:
 *   { file: string, table: string, message: string }
 *
 * @param {string|null|undefined} sql
 * @param {string} filename - for the issue.file field; identifier only
 * @returns {Array<{file: string, table: string, message: string}>}
 */
function auditMigrationGrants(sql, filename) {
  if (typeof sql !== 'string' || sql.length === 0) return [];

  const stripped = stripLineComments(sql);
  const issues = [];

  CREATE_TABLE_RE.lastIndex = 0;
  let match;
  while ((match = CREATE_TABLE_RE.exec(stripped)) !== null) {
    const table = match[1].replace(/"/g, '');
    const { ok, missingPrivs } = hasFullGrant(stripped, table);
    if (!ok) {
      const missingList = missingPrivs.join(', ');
      issues.push({
        file: filename,
        table,
        message:
          `Table "${table}" is missing GRANT [${missingList}] ON ${table} TO aiwholesail. ` +
          `Add a GRANT block or the live API will 500 with "permission denied" on first access.`,
      });
    }
  }

  CREATE_SEQUENCE_RE.lastIndex = 0;
  while ((match = CREATE_SEQUENCE_RE.exec(stripped)) !== null) {
    const seq = match[1].replace(/"/g, '');
    if (!hasSequenceGrant(stripped, seq)) {
      issues.push({
        file: filename,
        table: seq,
        message:
          `Sequence "${seq}" is missing GRANT USAGE ON SEQUENCE ${seq} TO aiwholesail. ` +
          `Without it, INSERTs on the parent table fail with "permission denied for sequence".`,
      });
    }
  }

  return issues;
}

/**
 * Audit an entire migrations directory. Resolves the legacy pattern
 * where a `CREATE TABLE` in file N is followed by a separate GRANT
 * file at N+M (e.g. 013_llm_token_ledger.sql + 019_llm_token_ledger_grant.sql).
 *
 * Files are processed in lexicographic order to mirror the migrate
 * runner's ordering. A GRANT in an EARLIER file does NOT satisfy a
 * LATER CREATE TABLE — that's a runtime apply-error.
 *
 * @param {Record<string, string>|null|undefined} filesByName - filename → SQL
 * @returns {Array<{file: string, table: string, message: string}>}
 */
function auditMigrationsDirectory(filesByName) {
  if (!filesByName || typeof filesByName !== 'object') return [];

  const sortedNames = Object.keys(filesByName).sort();
  const stripped = sortedNames.map((name) => ({
    name,
    sql: stripLineComments(filesByName[name] || ''),
  }));

  const issues = [];

  for (let i = 0; i < stripped.length; i++) {
    const { name, sql } = stripped[i];
    const concatFromHere = stripped.slice(i).map((s) => s.sql).join('\n');

    CREATE_TABLE_RE.lastIndex = 0;
    let match;
    while ((match = CREATE_TABLE_RE.exec(sql)) !== null) {
      const table = match[1].replace(/"/g, '');
      const { ok, missingPrivs } = hasFullGrant(concatFromHere, table);
      if (!ok) {
        const missingList = missingPrivs.join(', ');
        issues.push({
          file: name,
          table,
          message:
            `Table "${table}" is missing GRANT [${missingList}] ON ${table} TO aiwholesail. ` +
            `Either add a GRANT block to this migration or to a strictly later migration in the directory.`,
        });
      }
    }

    CREATE_SEQUENCE_RE.lastIndex = 0;
    while ((match = CREATE_SEQUENCE_RE.exec(sql)) !== null) {
      const seq = match[1].replace(/"/g, '');
      if (!hasSequenceGrant(concatFromHere, seq)) {
        issues.push({
          file: name,
          table: seq,
          message:
            `Sequence "${seq}" is missing GRANT USAGE ON SEQUENCE ${seq} TO aiwholesail. ` +
            `Without it, INSERTs on the parent table fail with "permission denied for sequence".`,
        });
      }
    }
  }

  return issues;
}

/**
 * Compare a current issue list against a known-baseline list. Issues
 * that already exist in the baseline are suppressed; issues new to
 * the current run are flagged as regressions; baseline entries no
 * longer in current are surfaced as "fixed" so the reviewer can
 * update the baseline file in the same PR.
 *
 * Match key is (file, table). Two issues for the same table in
 * different migration files are treated as distinct entries.
 *
 * @param {Array<{file: string, table: string}>|null} current
 * @param {Array<{file: string, table: string}>|null} baseline
 * @returns {{newIssues: Array<{file: string, table: string, message: string}>, fixed: Array<{file: string, table: string}>}}
 */
function diffAgainstBaseline(current, baseline) {
  const curr = Array.isArray(current) ? current : [];
  const base = Array.isArray(baseline) ? baseline : [];

  const key = (issue) => `${issue.file}::${issue.table}`;
  const baseSet = new Set(base.map(key));
  const currSet = new Set(curr.map(key));

  const newIssues = curr.filter((i) => !baseSet.has(key(i)));
  const fixed = base.filter((i) => !currSet.has(key(i)));

  return { newIssues, fixed };
}

module.exports = {
  auditMigrationGrants,
  auditMigrationsDirectory,
  diffAgainstBaseline,
};
