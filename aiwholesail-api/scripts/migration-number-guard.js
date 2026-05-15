// Migration-number collision guard.
//
// Sibling to migration-grant-guard.js. Catches a second recurring P0:
// two migration files claiming the same numeric prefix (e.g. PR #341
// and PR #346 both shipping `022_email_suppression_and_replies.sql`
// while main already had `022_auth_zombie_events.sql`).
//
// The migrate runner processes files in lexicographic order, so a
// duplicate prefix means one file silently wins and the other never
// applies. The symptom in prod is identical to the missing-GRANT class:
// the API 500s with "permission denied" because the table never exists.
//
// Pure JS / ESM so the tests run under `node --test`. Same pattern as
// migration-grant-guard.js, auction-detection.js (#408),
// comps-similarity.js (#371).

'use strict';

const PREFIX_RE = /^(\d+)_.+\.sql$/;

/**
 * Returns the leading numeric prefix of a migration filename, or null
 * when the filename doesn't fit the standard `<digits>_<name>.sql` shape.
 *
 * @param {string} filename
 * @returns {number|null}
 */
function extractMigrationNumber(filename) {
  if (typeof filename !== 'string') return null;
  const match = PREFIX_RE.exec(filename);
  if (!match) return null;
  const n = Number.parseInt(match[1], 10);
  return Number.isInteger(n) ? n : null;
}

/**
 * Scan a list of migration filenames and flag every numeric prefix
 * that appears on more than one file. Non-migration files (README,
 * helpers, non-numbered .sql) are ignored.
 *
 * @param {string[]|null|undefined} filenames
 * @returns {Array<{number: number, files: string[], message: string}>}
 */
function auditMigrationNumbers(filenames) {
  if (!Array.isArray(filenames)) return [];

  const byNumber = new Map();
  for (const f of filenames) {
    const n = extractMigrationNumber(f);
    if (n === null) continue;
    if (!byNumber.has(n)) byNumber.set(n, []);
    byNumber.get(n).push(f);
  }

  const issues = [];
  for (const [number, files] of byNumber.entries()) {
    if (files.length >= 2) {
      issues.push({
        number,
        files: [...files].sort(),
        message:
          `Migration number ${String(number).padStart(3, '0')} collides across ${files.length} files: ${[...files].sort().join(', ')}. ` +
          `The migrate runner picks one alphabetically; the others silently skip. Renumber all but one to a free slot.`,
      });
    }
  }

  issues.sort((a, b) => a.number - b.number);
  return issues;
}

/**
 * Compare current collisions to a known-baseline. Baseline entries
 * (legacy collisions inherited from parallel-agent merges) are
 * suppressed; collisions new to the current run, OR existing
 * baseline collisions that have GROWN (extra file added at the same
 * number), are flagged as regressions. Baseline entries no longer
 * present in current are returned in `resolved` so the reviewer can
 * update the baseline file.
 *
 * Match key for suppression: `number` + exact file list. A grown
 * collision shares the number but has more files — that counts as a
 * regression because the new file is what we want to block.
 *
 * @param {Array<{number: number, files: string[]}>|null} current
 * @param {Array<{number: number, files: string[]}>|null} baseline
 * @returns {{newIssues: Array<{number: number, files: string[], message: string}>, resolved: Array<{number: number, files: string[]}>}}
 */
function diffNumbersAgainstBaseline(current, baseline) {
  const curr = Array.isArray(current) ? current : [];
  const base = Array.isArray(baseline) ? baseline : [];

  const baseByNumber = new Map(base.map((b) => [b.number, b.files || []]));
  const currByNumber = new Map(curr.map((c) => [c.number, c]));

  const newIssues = [];
  for (const c of curr) {
    const baselineFiles = baseByNumber.get(c.number);
    if (!baselineFiles) {
      newIssues.push(c);
      continue;
    }
    const baselineSet = new Set(baselineFiles);
    const added = c.files.filter((f) => !baselineSet.has(f));
    if (added.length > 0) {
      newIssues.push({
        ...c,
        message:
          `Migration number ${String(c.number).padStart(3, '0')} collision grew — ` +
          `${added.length} file(s) added: ${added.join(', ')}. ` +
          `The pre-existing legacy collision is baselined; new additions are not allowed.`,
      });
    }
  }

  const resolved = base.filter((b) => !currByNumber.has(b.number));

  return { newIssues, resolved };
}

module.exports = {
  auditMigrationNumbers,
  extractMigrationNumber,
  diffNumbersAgainstBaseline,
};
