#!/usr/bin/env node
/**
 * Live smoke tests for every Zillow scrape.do action.
 *
 * Loops over every action registered in `SCRAPE_DO_ACTIONS` (lib/agent/zillowProxy.js)
 * with a known-good input, records success/fail + latency + payload size, and
 * writes a JSON report.
 *
 * COST: each successful detail-class call is one scrape.do request (~$0.002).
 * Search-class calls cost the same. `mortgageRates`, `agentProfile`, and
 * `marketStats` use `super=true` and cost ~$0.004 each. A full run is ~25
 * calls = ~$0.06 — small but non-zero. **Do not run automatically in CI.**
 *
 * Usage:
 *   cd aiwholesail-api
 *   SCRAPE_DO_API_TOKEN=... node scripts/smoke-test-zillow-actions.js
 *
 *   # write report to custom path
 *   SCRAPE_DO_API_TOKEN=... node scripts/smoke-test-zillow-actions.js \
 *     --out=/tmp/zillow-smoke.json
 *
 *   # run only one action (debugging)
 *   SCRAPE_DO_API_TOKEN=... node scripts/smoke-test-zillow-actions.js \
 *     --only=walkScore
 */

const fs = require('fs');
const path = require('path');
const zillowScrapeDo = require('../lib/scrapers/zillowScrapeDo');

// Known-good Austin, TX listing — long-tenured and stable. If this gets
// delisted, swap for another. Live as of 2026-05-12.
const DEFAULT_ZPID = '145656008';
const DEFAULT_LOCATION = 'Austin, TX';

// Per-action input specs. Anything missing here is skipped.
const ACTION_INPUTS = {
  // Detail-class:
  propertyDetails: { zpid: DEFAULT_ZPID },
  photos: { zpid: DEFAULT_ZPID },
  taxes: { zpid: DEFAULT_ZPID },
  priceHistory: { zpid: DEFAULT_ZPID },
  zestimate: { zpid: DEFAULT_ZPID },
  rentalEstimate: { zpid: DEFAULT_ZPID },
  zestimateHistory: { zpid: DEFAULT_ZPID },
  schools: { zpid: DEFAULT_ZPID },
  comps: { zpid: DEFAULT_ZPID },
  walkScore: { zpid: DEFAULT_ZPID },
  climateRisk: { zpid: DEFAULT_ZPID },
  openHouses: { zpid: DEFAULT_ZPID },
  rentalComps: { zpid: DEFAULT_ZPID },
  recentlySoldNearby: { zpid: DEFAULT_ZPID, radius_mi: 0.5 },
  // Search-class:
  search: { location: DEFAULT_LOCATION },
  searchByAddress: { address: DEFAULT_LOCATION },
  searchByCoordinates: { lat: 30.2672, lng: -97.7431, radius_mi: 1 },
  searchByBounds: { sw_lat: 30.20, sw_lng: -97.80, ne_lat: 30.30, ne_lng: -97.70 },
  searchByUrl: { url: 'https://www.zillow.com/homes/austin-tx_rb/' },
  forSale: { location: DEFAULT_LOCATION },
  forRent: { location: DEFAULT_LOCATION },
  recentlySold: { location: DEFAULT_LOCATION },
  foreclosures: { location: DEFAULT_LOCATION },
  fsbo: { location: DEFAULT_LOCATION },
  comingSoon: { location: DEFAULT_LOCATION },
  auctionListings: { location: DEFAULT_LOCATION },
  // Value / market / mortgage / agent:
  mortgageRates: { zip: '78701' },
  mortgageCalculator: { price: 400000, term: 30, rate: 7 }, // pure math — no network
  agentProfile: { slug: 'jane-doe-1234' }, // PLACEHOLDER slug; live runs likely 404
  marketStats: { region: DEFAULT_LOCATION },
};

function parseArgs(argv) {
  const args = {};
  for (const a of argv.slice(2)) {
    if (a.startsWith('--out=')) args.out = a.slice(6);
    else if (a.startsWith('--only=')) args.only = a.slice(7);
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`smoke-test-zillow-actions.js
  --out=<path>       Where to write the JSON report (default: /tmp/zillow-smoke-<ts>.json)
  --only=<action>    Run only one action (debugging)`);
}

async function timeIt(fn) {
  const t0 = Date.now();
  try {
    const data = await fn();
    return { ok: true, ms: Date.now() - t0, data };
  } catch (err) {
    return {
      ok: false,
      ms: Date.now() - t0,
      error: err && err.message ? err.message : String(err),
      reason: err && err.reason,
    };
  }
}

function summarize(data) {
  // Lightweight summary — we don't want a 2MB JSON.
  if (data == null) return null;
  if (typeof data !== 'object') return data;
  const keys = Array.isArray(data) ? `array[${data.length}]` : Object.keys(data).slice(0, 24);
  // Snapshot first few key=value pairs for eyeballing
  let preview;
  if (!Array.isArray(data)) {
    const out = {};
    for (const k of Object.keys(data).slice(0, 10)) {
      const v = data[k];
      if (Array.isArray(v)) out[k] = `array[${v.length}]`;
      else if (v && typeof v === 'object') out[k] = '<object>';
      else if (typeof v === 'string') out[k] = v.length > 80 ? `${v.slice(0, 80)}…` : v;
      else out[k] = v;
    }
    preview = out;
  }
  return { keys, preview };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { usage(); process.exit(0); }

  if (!process.env.SCRAPE_DO_API_TOKEN) {
    console.error('SCRAPE_DO_API_TOKEN is not set; live scrape.do calls will fail.');
    process.exit(1);
  }

  const results = [];
  const actions = Object.keys(ACTION_INPUTS).filter((a) => !args.only || a === args.only);

  console.log(`Running ${actions.length} action(s) against scrape.do …`);
  for (const action of actions) {
    const fn = zillowScrapeDo[action];
    const input = ACTION_INPUTS[action];
    if (typeof fn !== 'function') {
      results.push({ action, ok: false, error: 'no handler', input });
      continue;
    }
    process.stdout.write(`  ${action} … `);
    // mortgageCalculator is pure math — wrap so the loop is consistent.
    const result = await timeIt(() => Promise.resolve(fn(input)));
    if (result.ok) {
      const json = JSON.stringify(result.data);
      result.payloadBytes = Buffer.byteLength(json);
      result.summary = summarize(result.data);
      delete result.data;
    }
    results.push({ action, input, ...result });
    console.log(`${result.ok ? 'OK' : 'FAIL'} (${result.ms}ms${result.payloadBytes ? `, ${result.payloadBytes}B` : ''})${result.ok ? '' : ` — ${result.error}`}`);
  }

  const out = args.out || `/tmp/zillow-smoke-${Date.now()}.json`;
  fs.writeFileSync(out, JSON.stringify({
    runAt: new Date().toISOString(),
    summary: {
      total: results.length,
      passed: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
    },
    results,
  }, null, 2));
  console.log(`\nWrote ${out}`);

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.log(`\n${failed.length} failed:`);
    for (const f of failed) console.log(`  - ${f.action}: ${f.error}`);
    // Exit 1 so CI / operators notice; comingSoon, climateRisk, etc may
    // legitimately fail with 'no_data_in_payload' on some listings — operator
    // judgement required.
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(2);
  });
}

module.exports = { ACTION_INPUTS, summarize };
