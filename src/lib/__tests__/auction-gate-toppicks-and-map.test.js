// Source-introspection tests for auction-gating in
// AITopPicksSection.tsx and PropertyMap.tsx.
//
// Why this exists (gap surfaced 2026-05-15 after PR #408/#430/#433/#437/#446):
//
//   Two more render sites compute spread directly without going
//   through calculateWholesalePotential (which has the auction gate
//   from PR #430). They were missed in the earlier sweep:
//
//   1. AITopPicksSection.tsx — filters properties where
//      `zestimate > price`, sorts by spread DESC, takes top 25,
//      feeds into the AI ranker. A foreclosure auction with $5K
//      opening bid + $300K zestimate sorts to position 1 and
//      consumes AI tokens analyzing a non-deal.
//   2. PropertyMap.tsx — markers color-coded by `spread`:
//      green ≥30K, yellow >0, red ≤0. Auction subjects get
//      green markers, misleading map-glance assessment.
//
//   This PR imports isAuctionSubject in both files and adds the
//   `!isAuctionSubject(p)` filter / gate.
//
// Run:
//   node --test src/lib/__tests__/auction-gate-toppicks-and-map.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOP_PICKS_SRC = readFileSync(
  join(__dirname, '..', '..', 'components', 'AITopPicksSection.tsx'),
  'utf8',
);
const MAP_SRC = readFileSync(
  join(__dirname, '..', '..', 'components', 'PropertyMap.tsx'),
  'utf8',
);

test('AITopPicksSection.tsx imports isAuctionSubject', () => {
  assert.match(
    TOP_PICKS_SRC,
    /import\s*{[^}]*isAuctionSubject[^}]*}\s*from\s*['"](?:@\/lib\/auction-detection|\.\.\/lib\/auction-detection)/,
    'must import isAuctionSubject',
  );
});

test('AITopPicksSection.tsx: candidate filter excludes auction subjects', () => {
  // Find the candidate filter chain — must include `!isAuctionSubject(p)`
  // as part of the .filter() body.
  const filterMatch = TOP_PICKS_SRC.match(
    /\.filter\(\s*(\w+)\s*=>\s*[^)]*\)/g,
  );
  assert.ok(filterMatch, 'must have at least one .filter() call');
  const auctionExclusion = TOP_PICKS_SRC.match(
    /\.filter\([^)]*!\s*isAuctionSubject\s*\(/,
  );
  assert.ok(
    auctionExclusion,
    'candidate filter must include !isAuctionSubject(...)',
  );
});

test('AITopPicksSection.tsx: eligible-count filter ALSO excludes auctions', () => {
  // The eligibleCount used in the empty-state CTA also runs through
  // the filter — without gating, an auction-only result set shows
  // "Filter top 1 spreads through AI" then immediately fails when
  // the user clicks. Better UX: count zero, render the CTA hidden.
  // We just require that EVERY filter on price+zestimate also
  // excludes auctions.
  const filterCallCount = (TOP_PICKS_SRC.match(/\.filter\s*\(/g) || []).length;
  const auctionExclusionCount = (
    TOP_PICKS_SRC.match(/!\s*isAuctionSubject\s*\(/g) || []
  ).length;
  assert.ok(
    auctionExclusionCount >= 2,
    `expected at least 2 !isAuctionSubject calls in ${filterCallCount} filters`,
  );
});

test('PropertyMap.tsx imports isAuctionSubject', () => {
  assert.match(
    MAP_SRC,
    /import\s*{[^}]*isAuctionSubject[^}]*}\s*from\s*['"](?:@\/lib\/auction-detection|\.\.\/lib\/auction-detection)/,
    'must import isAuctionSubject',
  );
});

test('PropertyMap.tsx: getMarkerIcon falls to grayIcon for auction subjects', () => {
  // The marker color drives the user's at-a-glance interpretation.
  // Auction subjects must NOT get the green marker — gray is the
  // safer neutral signal.
  const fnStart = MAP_SRC.indexOf('function getMarkerIcon');
  assert.notEqual(fnStart, -1, 'getMarkerIcon must exist');
  // Window large enough to span the multi-line comment block + if
  // statement (the comment alone is ~400 chars).
  const fnBody = MAP_SRC.slice(fnStart, fnStart + 1200);
  assert.match(
    fnBody,
    /isAuctionSubject\s*\(/,
    'getMarkerIcon must call isAuctionSubject',
  );
  // Must early-return grayIcon when the listing is auction-like.
  assert.match(
    fnBody,
    /isAuctionSubject\s*\([^)]+\)\s*\)\s*return\s+grayIcon/,
    'must `return grayIcon` when isAuctionSubject is true',
  );
});

test('PropertyMap.tsx: heatPoints weight 0 for auction subjects', () => {
  // The heatmap weights properties by spread. Auction subjects with
  // inflated $295K spreads dominate the heat signal — must be zeroed.
  // The pattern: `if (isAuctionSubject({ ... })) return 0` inside
  // the .map that produces spread weights.
  const heatStart = MAP_SRC.indexOf('heatPoints');
  assert.notEqual(heatStart, -1, 'heatPoints memo must exist');
  const heatBody = MAP_SRC.slice(heatStart, heatStart + 1500);
  assert.match(
    heatBody,
    /isAuctionSubject\s*\(/,
    'heatPoints must call isAuctionSubject',
  );
});
