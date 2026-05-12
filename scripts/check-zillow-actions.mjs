#!/usr/bin/env node
/**
 * Zillow proxy action guard.
 *
 * Every method on `ZillowAPI` (src/lib/zillow-api.ts) that hits the proxy
 * routes through `this.callApi('actionName', params)`. The proxy at
 * /root/zillow-api/index.js on the VPS supports a specific allowlist of
 * actions and explicitly rejects a known set with "Action is not supported
 * by the current API".
 *
 * Background: PR #203 shipped getWalkScore() → callApi('walkScore', ...).
 * The proxy rejects 'walkScore'. The Neighborhood tab rendered "Could not
 * load walk score" in production for ~41 minutes until PR #207 hot-fixed
 * it. This script exists to catch that class of regression at PR time.
 *
 * Rules:
 *   1. Every `callApi('X', ...)` in zillow-api.ts must have X in SUPPORTED.
 *   2. No `callApi('X', ...)` may use X from REJECTED.
 *
 * When the upstream proxy adds or removes an action, update the lists
 * below in the same PR.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const TARGET = join(REPO_ROOT, 'src/lib/zillow-api.ts');

// Proxy at /root/zillow-api/index.js confirmed-supported actions.
// Source of truth = proxy file. Keep alphabetised.
const SUPPORTED = new Set([
  'agentDetails',
  'agentListings',
  'agentReviews',
  'agentSearch',
  'agentSold',
  'autocomplete',
  'comps',
  'market',
  'mortgage',
  'mortgageRates',
  'photos',
  'priceHistory',
  'propertyByAddress',
  'propertyByUrl',
  'propertyDetails',
  'rentalEstimate',
  'schools',
  'search',
  'searchByAddress',
  'searchByBounds',
  'searchByCoordinates',
  'searchByMls',
  'searchByUrl',
  'taxes',
  'test',
  'zestimate',
  'zestimateHistory',
]);

// Proxy explicitly returns "Action is not supported by the current API"
// for these. The upstream Zillow Scraper plan does not expose them.
// Listed here so CI fails fast if a dev re-introduces a call.
const REJECTED = new Set([
  'comparableHomes',
  'deepComps',
  'deepSearch',
  'extendedSearch',
  'skipTrace',
  'walkScore',
]);

const src = readFileSync(TARGET, 'utf8');

// Match callApi('action', ...) or callApi("action", ...) — capture the literal.
const re = /callApi\(\s*['"]([a-zA-Z0-9_]+)['"]/g;
const found = new Set();
for (const m of src.matchAll(re)) found.add(m[1]);

const unknown = [...found].filter((a) => !SUPPORTED.has(a));
const rejected = [...found].filter((a) => REJECTED.has(a));

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

if (rejected.length > 0) {
  console.error(`${RED}✗ FAIL${RESET}: ${rejected.length} call(s) reference a proxy-rejected action:`);
  for (const a of rejected) console.error(`    callApi('${a}', ...)`);
  console.error('');
  console.error('The proxy at /root/zillow-api/index.js explicitly rejects these');
  console.error('actions because the upstream Zillow Scraper plan does not expose');
  console.error('them. Remove the call OR change the proxy if you have a new plan.');
  process.exit(1);
}

if (unknown.length > 0) {
  console.error(`${RED}✗ FAIL${RESET}: ${unknown.length} unrecognised proxy action(s) in zillow-api.ts:`);
  for (const a of unknown) console.error(`    callApi('${a}', ...)`);
  console.error('');
  console.error('Before merging:');
  console.error('  1. Verify the proxy at /root/zillow-api/index.js supports it');
  console.error("     (curl -s 'https://api.aiwholesail.com/zillow/zillow?action=" + unknown[0] + "&zpid=12345' | head -c 200)");
  console.error('  2. If supported, add to SUPPORTED in scripts/check-zillow-actions.mjs');
  console.error('  3. If rejected, remove the call (or stub it like getWalkScore)');
  process.exit(1);
}

const sortedFound = [...found].sort();
console.log(`${GREEN}✓ PASS${RESET}: ${found.size} proxy action(s) in zillow-api.ts, all known-supported.`);
console.log(`${YELLOW}supported references:${RESET} ${sortedFound.join(', ')}`);
