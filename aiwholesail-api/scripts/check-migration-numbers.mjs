#!/usr/bin/env node
// CLI guard: scan migration filenames and exit non-zero when two or
// more files claim the same numeric prefix beyond what the baseline
// allows. Catches the PR #341 vs #346 collision-class regression at
// PR time, not in prod.
//
// Baseline mode: legacy collisions live in
// `migration-number-baseline.json` and are suppressed. A baselined
// collision that grows (extra file added) is still flagged.
//
// Run locally:
//   node aiwholesail-api/scripts/check-migration-numbers.mjs
//
// Regenerate baseline (after fixing legacy entries):
//   node aiwholesail-api/scripts/check-migration-numbers.mjs --update-baseline

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  auditMigrationNumbers,
  diffNumbersAgainstBaseline,
} = require('./migration-number-guard.js');

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');
const BASELINE_PATH = join(__dirname, 'migration-number-baseline.json');

const entries = await readdir(MIGRATIONS_DIR);
const collisions = auditMigrationNumbers(entries);

const updateMode = process.argv.includes('--update-baseline');
if (updateMode) {
  await writeFile(
    BASELINE_PATH,
    JSON.stringify(
      {
        note:
          'Legacy migration-number collisions inherited from parallel-agent merges. ' +
          'New PRs MUST NOT add another file at any of these numbers — the guard fails on ' +
          'any number not in this baseline. To regenerate after renaming legacy files: ' +
          'node aiwholesail-api/scripts/check-migration-numbers.mjs --update-baseline',
        collisions: collisions.map((c) => ({ number: c.number, files: c.files })),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Baseline updated with ${collisions.length} entries.`);
  process.exit(0);
}

let baseline = [];
try {
  const raw = await readFile(BASELINE_PATH, 'utf8');
  baseline = JSON.parse(raw).collisions || [];
} catch {
  // Baseline missing — treat as empty (strictest mode).
}

const { newIssues, resolved } = diffNumbersAgainstBaseline(collisions, baseline);

if (resolved.length > 0) {
  console.log(
    `migration-number-guard: ${resolved.length} baseline collision(s) resolved — please run --update-baseline:`,
  );
  for (const r of resolved) console.log(`  ✓ ${String(r.number).padStart(3, '0')}: was ${r.files.join(', ')}`);
  console.log('');
}

if (newIssues.length === 0) {
  console.log(
    `migration-number-guard: ${entries.length} files scanned, 0 new collisions (${baseline.length} legacy suppressed). ✓`,
  );
  process.exit(0);
}

console.error(
  `migration-number-guard: ${newIssues.length} NEW collision(s) — these are not in the baseline and must be fixed before merge:\n`,
);
for (const issue of newIssues) {
  console.error(`  ✗ ${String(issue.number).padStart(3, '0')}: ${issue.message}`);
}
console.error(
  '\nRename all but one of the colliding files to the next free numeric prefix.\n' +
  'List free prefixes by running:\n' +
  '  ls aiwholesail-api/migrations | grep -oE "^[0-9]+" | sort -un | tail -5\n',
);
process.exit(1);
