#!/usr/bin/env node
/**
 * Shadow-compare RapidAPI's `zillow-working-api` vs the self-hosted scrape.do
 * scraper across a representative set of addresses, and emit a parity report.
 *
 * Why this exists: before flipping the global rollout from RapidAPI to
 * scrape.do for the property-details path, we need hard evidence that the
 * payloads agree field-by-field. This script runs the SAME action against
 * both backends, normalizes responses through the canonical field set used
 * by `mapPropertyToRapidApiShape` in `lib/scrapers/zillowScrapeDo.js`, and
 * writes both a JSON report and a human-readable markdown summary.
 *
 * Standalone — no DB writes. Output goes to disk only.
 *
 * Usage:
 *   cd aiwholesail-api
 *   RAPIDAPI_KEY=... SCRAPE_DO_API_TOKEN=... \
 *     node scripts/shadow-compare-zillow.js
 *
 *   # custom CSV
 *   node scripts/shadow-compare-zillow.js scripts/fixtures/my-list.csv
 *
 *   # stop after first 3 rows
 *   node scripts/shadow-compare-zillow.js --limit 3
 *
 *   # print the plan, don't make any HTTP calls (no $$ to scrape.do)
 *   node scripts/shadow-compare-zillow.js --dry-run
 *
 * The script intentionally sleeps 1s between rows to be polite to both
 * providers (esp. scrape.do, which charges per request).
 */

const fs = require('fs');
const path = require('path');

const {
  CANONICAL_FIELDS,
  diffFields,
  aggregate,
  formatMarkdown,
} = require('./lib/shadowCompareDiff');

// ---- argv parsing ----------------------------------------------------------

function parseArgs(argv) {
  const args = { csv: null, limit: null, dryRun: false };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--dry-run') {
      args.dryRun = true;
    } else if (a === '--limit') {
      args.limit = parseInt(rest[++i], 10);
      if (!Number.isFinite(args.limit) || args.limit <= 0) {
        throw new Error(`--limit must be a positive integer, got: ${rest[i]}`);
      }
    } else if (a.startsWith('--limit=')) {
      args.limit = parseInt(a.slice('--limit='.length), 10);
      if (!Number.isFinite(args.limit) || args.limit <= 0) {
        throw new Error(`--limit must be a positive integer, got: ${a}`);
      }
    } else if (a.startsWith('--')) {
      throw new Error(`Unknown flag: ${a}`);
    } else if (!args.csv) {
      args.csv = a;
    } else {
      throw new Error(`Unexpected positional arg: ${a}`);
    }
  }
  return args;
}

// ---- CSV (minimal — quoted fields with commas inside, no escapes) ---------

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = splitCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const row = Object.create(null);
    headers.forEach((h, idx) => { row[h] = cells[idx] ?? ''; });
    rows.push(row);
  }
  return { headers, rows };
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { cur += c; }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      out.push(cur); cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

// ---- I/O ------------------------------------------------------------------

const DEFAULT_CSV = path.join(__dirname, 'fixtures', 'shadow-addresses.csv');
const OUTPUT_DIR = path.join(__dirname, 'shadow-compare-output');

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function utcTimestampSlug(d = new Date()) {
  // 2026-05-13T14-22-09Z — filesystem-safe ISO.
  return d.toISOString().replace(/[:.]/g, '-').replace(/-\d{3}Z$/, 'Z');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- backend callers ------------------------------------------------------

/**
 * Call zillow-working-api on RapidAPI for a single address.
 * Returns {ok, ms, status, data, error}.
 */
async function callRapidApi(address, { axios, apiKey }) {
  const t0 = Date.now();
  try {
    const resp = await axios.get('https://zillow-working-api.p.rapidapi.com/pro/byaddress', {
      params: { propertyaddress: address },
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'zillow-working-api.p.rapidapi.com',
      },
      timeout: 30000,
      validateStatus: () => true,
    });
    const ms = Date.now() - t0;
    if (resp.status >= 200 && resp.status < 300) {
      return { ok: true, ms, status: resp.status, data: resp.data };
    }
    return { ok: false, ms, status: resp.status, data: resp.data, error: `HTTP ${resp.status}` };
  } catch (err) {
    return { ok: false, ms: Date.now() - t0, status: null, error: err.message || String(err) };
  }
}

/**
 * Call the self-hosted scrape.do scraper for a single address.
 * The scraper lives at `lib/scrapers/zillowScrapeDo.js` (added by the queued
 * feature PRs). It throws on non-2xx, so we catch and surface the error.
 *
 * The require is lazy so this script can still be loaded for --dry-run and
 * unit tests on branches where the scraper module isn't present yet.
 */
async function callScrapeDo(address) {
  let scraper;
  try {
    scraper = require('../lib/scrapers/zillowScrapeDo');
  } catch (err) {
    return { ok: false, ms: 0, error: `scraper module not available on this branch: ${err.message}` };
  }
  if (typeof scraper.propertyDetails !== 'function') {
    return { ok: false, ms: 0, error: 'zillowScrapeDo.propertyDetails is not a function' };
  }
  const t0 = Date.now();
  try {
    const data = await scraper.propertyDetails({ address });
    return { ok: true, ms: Date.now() - t0, data };
  } catch (err) {
    return { ok: false, ms: Date.now() - t0, error: err.message || String(err) };
  }
}

// ---- main -----------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);
  const csvPath = args.csv ? path.resolve(args.csv) : DEFAULT_CSV;

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`);
    process.exit(1);
  }
  const csvText = fs.readFileSync(csvPath, 'utf8');
  const { rows: csvRows } = parseCsv(csvText);
  const inputs = csvRows
    .map((r) => ({ address: r.address || r.Address || '' }))
    .filter((r) => r.address);
  const work = args.limit ? inputs.slice(0, args.limit) : inputs;

  console.log(`shadow-compare-zillow: ${work.length} address(es) from ${csvPath}`);
  if (args.dryRun) {
    console.log('[DRY-RUN] No HTTP calls will be made. Plan:');
    work.forEach((r, i) => console.log(`  ${i + 1}. ${r.address}`));
    console.log(`Would write reports to: ${OUTPUT_DIR}`);
    return;
  }

  const rapidapiKey = process.env.RAPIDAPI_KEY;
  if (!rapidapiKey) {
    console.error('RAPIDAPI_KEY env var is required (or pass --dry-run).');
    process.exit(1);
  }
  // axios is a runtime dep of the API; require it here so --dry-run works
  // even in stripped-down environments.
  // eslint-disable-next-line global-require
  const axios = require('axios');

  const ranAt = new Date().toISOString();
  const rows = [];
  for (let i = 0; i < work.length; i++) {
    const input = work[i];
    process.stdout.write(`[${i + 1}/${work.length}] ${input.address} ... `);
    const [rapidapi, scrapeDo] = [
      await callRapidApi(input.address, { axios, apiKey: rapidapiKey }),
      await callScrapeDo(input.address),
    ];
    const diff = (rapidapi.ok && scrapeDo.ok)
      ? diffFields(rapidapi.data, scrapeDo.data, CANONICAL_FIELDS)
      : [];
    rows.push({ input, rapidapi, scrapeDo, diff });
    console.log(`rapidapi=${rapidapi.ok ? 'ok' : 'fail'} scrape.do=${scrapeDo.ok ? 'ok' : 'fail'} diff=${diff.length}`);
    if (i < work.length - 1) await sleep(1000);
  }

  const summary = aggregate(rows, CANONICAL_FIELDS);
  const report = { ranAt, ...summary, rows };
  const md = formatMarkdown(summary, rows, ranAt, CANONICAL_FIELDS);

  ensureOutputDir();
  const slug = utcTimestampSlug(new Date(ranAt));
  const jsonPath = path.join(OUTPUT_DIR, `${slug}.json`);
  const mdPath = path.join(OUTPUT_DIR, `${slug}.md`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdPath, md);

  console.log(`\nWrote:\n  ${jsonPath}\n  ${mdPath}`);
  console.log(`\nSummary: ${summary.bothSucceededCount}/${summary.totalRows} both succeeded; ${summary.bothFailedCount} both failed.`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('shadow-compare-zillow failed:', err);
    process.exit(1);
  });
}

module.exports = { parseArgs, parseCsv, splitCsvLine, utcTimestampSlug };
