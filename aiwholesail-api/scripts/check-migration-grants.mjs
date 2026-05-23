#!/usr/bin/env node
// CLI guard: scan every aiwholesail-api/migrations/*.sql file and exit
// non-zero when a NEW CREATE TABLE / CREATE SEQUENCE lacks the matching
// GRANT block for the aiwholesail role.
//
// Baseline mode: legacy missing-GRANT entries live in
// `migration-grant-baseline.json` and are suppressed. New PRs that
// introduce CREATE TABLE without GRANT will appear as a regression and
// fail CI. Pattern matches mypy / rubocop allow-lists.
//
// Wired into CI as a new step in .github/workflows/deploy.yml so the
// PR #131-class regression (live API 500s with "permission denied") is
// caught at PR time, not in prod.
//
// Run locally:
//   node aiwholesail-api/scripts/check-migration-grants.mjs
//
// Regenerate baseline (after fixing legacy entries):
//   node aiwholesail-api/scripts/check-migration-grants.mjs --update-baseline

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  auditMigrationsDirectory,
  diffAgainstBaseline,
} = require('./migration-grant-guard.js');

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');
const BASELINE_PATH = join(__dirname, 'migration-grant-baseline.json');

const entries = await readdir(MIGRATIONS_DIR);
const sqlFiles = entries.filter((f) => f.endsWith('.sql')).sort();

const filesByName = {};
for (const file of sqlFiles) {
  filesByName[file] = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
}

const allIssues = auditMigrationsDirectory(filesByName);

const updateMode = process.argv.includes('--update-baseline');
if (updateMode) {
  const baseline = allIssues.map(({ file, table }) => ({ file, table }));
  await writeFile(
    BASELINE_PATH,
    JSON.stringify(
      {
        generated: new Date().toISOString(),
        note:
          'Legacy missing-GRANT entries. Prod tolerates these via role-level permissions. ' +
          'New migrations MUST add GRANT blocks — guard fails on any (file,table) NOT in this baseline. ' +
          'To regenerate after fixing legacy entries: node aiwholesail-api/scripts/check-migration-grants.mjs --update-baseline',
        issues: baseline,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Baseline updated with ${baseline.length} entries.`);
  process.exit(0);
}

let baseline = [];
try {
  const raw = await readFile(BASELINE_PATH, 'utf8');
  baseline = JSON.parse(raw).issues || [];
} catch {
  // Baseline missing — treat as empty (strictest mode).
}

const { newIssues, fixed } = diffAgainstBaseline(allIssues, baseline);

if (fixed.length > 0) {
  console.log(
    `migration-grant-guard: ${fixed.length} baseline entry/entries no longer needed — please run --update-baseline:`,
  );
  for (const f of fixed) console.log(`  ✓ ${f.file}: ${f.table}`);
  console.log('');
}

if (newIssues.length === 0) {
  console.log(
    `migration-grant-guard: ${sqlFiles.length} files scanned, 0 new issues (${baseline.length} legacy suppressed). ✓`,
  );
  process.exit(0);
}

console.error(
  `migration-grant-guard: ${newIssues.length} NEW issue(s) — these are not in the baseline and must be fixed before merge:\n`,
);
for (const issue of newIssues) {
  console.error(`  ✗ ${issue.file}: ${issue.message}`);
}
console.error(
  '\nAdd a GRANT block like:\n' +
  '  GRANT SELECT, INSERT, UPDATE, DELETE ON <table> TO aiwholesail;\n' +
  'And for explicit sequences:\n' +
  '  GRANT USAGE, SELECT ON SEQUENCE <seq> TO aiwholesail;\n',
);
process.exit(1);
