#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path = require('path');

const { GENERATED_CLIP_DIR } = require('../services/videoClipper');
const { processDueItems } = require('../services/clipScheduler');

function parseArgs(argv) {
  const args = { positionals: [], flags: {} };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      args.positionals.push(token);
      continue;
    }

    if (token.includes('=')) {
      const [key, ...rest] = token.slice(2).split('=');
      args.flags[key] = rest.join('=');
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args.flags[key] = true;
      continue;
    }

    args.flags[key] = next;
    index += 1;
  }

  return args;
}

function boolFlag(value) {
  return value === true || value === 'true' || value === '1';
}

function formatPlatforms(platforms) {
  if (!Array.isArray(platforms) || platforms.length === 0) return 'default';
  return platforms.join(',');
}

function logProcessed(results) {
  for (const entry of results) {
    const ts = entry.lastAttemptAt || new Date().toISOString();
    const errSuffix = entry.status === 'failed' && entry.error ? ` — ${entry.error}` : '';
    console.log(
      `[clip-publish] ${ts} ${entry.runId} -> ${entry.status} (${formatPlatforms(entry.platforms)})${errSuffix}`
    );
  }
}

async function runOnce({ baseDir, dryRun }) {
  let results = [];
  try {
    results = await processDueItems({ baseDir, dryRun });
  } catch (error) {
    console.error(`[clip-publish] tick failed: ${error && error.message ? error.message : error}`);
    return [];
  }

  if (results.length === 0) {
    console.log(`[clip-publish] ${new Date().toISOString()} 0 due items`);
  } else {
    logProcessed(results);
  }
  return results;
}

async function main(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv);

  const baseDir = parsed.flags['base-dir']
    ? path.resolve(String(parsed.flags['base-dir']))
    : GENERATED_CLIP_DIR;
  const dryRun = boolFlag(parsed.flags['dry-run']);
  const once = boolFlag(parsed.flags.once);
  const intervalSeconds = parsed.flags['interval-seconds'] != null
    ? Math.max(1, Number(parsed.flags['interval-seconds']))
    : 60;

  let stopping = false;
  const onSignal = (signal) => {
    if (stopping) return;
    stopping = true;
    console.log(`[clip-publish] ${new Date().toISOString()} stopping (${signal})`);
    // give any in-flight save a moment, then exit
    setTimeout(() => process.exit(0), 50).unref();
  };
  process.on('SIGINT', () => onSignal('SIGINT'));
  process.on('SIGTERM', () => onSignal('SIGTERM'));

  if (once) {
    await runOnce({ baseDir, dryRun });
    return;
  }

  console.log(
    `[clip-publish] ${new Date().toISOString()} starting loop (baseDir=${baseDir}, interval=${intervalSeconds}s, dryRun=${dryRun})`
  );

  // Loop forever using setTimeout — wait for processing to finish before scheduling next tick.
  // eslint-disable-next-line no-constant-condition
  while (!stopping) {
    await runOnce({ baseDir, dryRun });
    if (stopping) break;
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, intervalSeconds * 1000);
      timer.unref();
    });
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[clip-publish] fatal: ${error && error.message ? error.message : error}`);
    process.exit(1);
  });
}

module.exports = { main };
