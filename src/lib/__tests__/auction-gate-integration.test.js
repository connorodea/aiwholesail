// Source-introspection tests for the auction-gate integration in
// wholesale-calculator.ts and PropertyCard.tsx.
//
// Why this exists (recurring P0 — same class as PR #408):
//
//   PR #408 gated the "Great Deal" badge in ComparableSalesTable on
//   isAuctionSubject. Two other render sites use the same `spread =
//   zestimate - price` heuristic and were NOT gated:
//
//   1. src/components/PropertyCard.tsx — renders TOP/GREAT/GOOD DEAL
//      banner on every search-result card. A foreclosure auction with
//      $5k opening bid and $300k zestimate gets a "TOP DEAL +$295k"
//      banner.
//   2. src/lib/wholesale-calculator.ts — calculateWholesalePotential()
//      drives the modal's "Excellent Deal" tier theming AND
//      sortPropertiesByWholesalePotential() ranks results. Auction
//      listings sort to the top with the highest "scores."
//
//   Wholesalers reading the search-result page see foreclosure
//   auctions ranked as the best deals, click through, and waste cycles
//   on listings that aren't market-priced.
//
// This is a source-introspection test (project pattern for TS files —
// see src/pages/__tests__/*.test.cjs). It pins the contract:
// the integration imports `isAuctionSubject` from auction-detection.js
// AND references it inside the relevant function/component. Behavioral
// correctness of isAuctionSubject itself is covered by
// auction-detection.test.js (12 cases). This file pins WIRING.
//
// Run:
//   node --test src/lib/__tests__/auction-gate-integration.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, '..', '..');

const WHOLESALE_SRC = readFileSync(
  join(SRC_DIR, 'lib', 'wholesale-calculator.ts'),
  'utf8',
);
const PROPERTY_CARD_SRC = readFileSync(
  join(SRC_DIR, 'components', 'PropertyCard.tsx'),
  'utf8',
);

test('wholesale-calculator.ts imports isAuctionSubject from auction-detection', () => {
  // The import is the integration entry point — without it, the gate
  // can't function. Match either `from '@/lib/auction-detection'` or
  // the relative path `from './auction-detection'` (both valid).
  const importPattern =
    /import\s*{[^}]*isAuctionSubject[^}]*}\s*from\s*['"](?:@\/lib\/auction-detection|\.\/auction-detection)/;
  assert.match(WHOLESALE_SRC, importPattern, 'wholesale-calculator must import isAuctionSubject');
});

test('calculateWholesalePotential calls isAuctionSubject before computing tier', () => {
  // Pin the call inside the function body. Without this, the import
  // exists but the gate doesn't fire — silent failure on every search.
  // Extract the function body and assert isAuctionSubject is referenced.
  const fnStart = WHOLESALE_SRC.indexOf('export function calculateWholesalePotential');
  assert.notEqual(fnStart, -1, 'calculateWholesalePotential must exist');
  // Function body extends to the next top-level "export " or "function "
  // or end of file. Cheap heuristic: take the next 3000 chars.
  const fnBody = WHOLESALE_SRC.slice(fnStart, fnStart + 3000);
  assert.match(
    fnBody,
    /isAuctionSubject\s*\(/,
    'calculateWholesalePotential body must call isAuctionSubject',
  );
});

test('calculateWholesalePotential returns tier=poor + score=0 for auction subjects', () => {
  // The expected gate behavior — when isAuctionSubject is true,
  // bail to the same shape as the no-price/no-zestimate path so
  // ranking and tier theming both degrade gracefully.
  const fnStart = WHOLESALE_SRC.indexOf('export function calculateWholesalePotential');
  const fnBody = WHOLESALE_SRC.slice(fnStart, fnStart + 3000);

  // Find the auction-gate block — must return tier 'poor' with score 0
  // and spreadAmount 0 (so the sort doesn't rank it above real deals).
  const auctionGateMatch = fnBody.match(
    /if\s*\(\s*isAuctionSubject\s*\([^)]*\)\s*\)\s*{[\s\S]{0,500}?}/,
  );
  assert.notEqual(auctionGateMatch, null, 'auction gate block must exist');
  const gateBody = auctionGateMatch[0];

  assert.match(gateBody, /tier:\s*['"]poor['"]/, 'must set tier to poor');
  assert.match(gateBody, /score:\s*0/, 'must set score to 0');
  assert.match(gateBody, /spreadAmount:\s*0/, 'must set spreadAmount to 0');
});

test('PropertyCard.tsx imports isAuctionSubject from auction-detection', () => {
  const importPattern =
    /import\s*{[^}]*isAuctionSubject[^}]*}\s*from\s*['"](?:@\/lib\/auction-detection|\.\.\/lib\/auction-detection|\.\/auction-detection)/;
  assert.match(
    PROPERTY_CARD_SRC,
    importPattern,
    'PropertyCard must import isAuctionSubject',
  );
});

test('PropertyCard.tsx gates the deal banner on isAuctionSubject', () => {
  // The banner block is the `{isQualifiedDeal && (...)}` JSX. We need
  // isQualifiedDeal to AND-include `!isAuctionSubject(property)` so
  // that auction subjects don't get the green TOP/GREAT/GOOD DEAL
  // ribbon. Same shape as the ComparableSalesTable gate from #408.
  // Look for `isAuctionLike` (the typical name) being used in the
  // ring/banner gating logic.
  const isAuctionLikeAssignment =
    /const\s+isAuctionLike\s*=\s*isAuctionSubject\s*\(/;
  assert.match(
    PROPERTY_CARD_SRC,
    isAuctionLikeAssignment,
    'PropertyCard must compute isAuctionLike from isAuctionSubject',
  );
  // The banner conditional must reference it
  assert.match(
    PROPERTY_CARD_SRC,
    /!isAuctionLike/,
    'PropertyCard must reference !isAuctionLike in render gating',
  );
});

test('PropertyCard.tsx isQualifiedDeal computation factors in the auction gate', () => {
  // Either isQualifiedDeal itself is && !isAuctionLike, OR
  // every consumer of isQualifiedDeal in the JSX is && !isAuctionLike.
  // Easier contract: assert one of those patterns is present.
  const eitherPattern =
    /(isQualifiedDeal\s*=\s*spread\s*>=\s*30000\s*&&\s*!isAuctionLike)|(isQualifiedDeal\s*&&\s*!isAuctionLike)/;
  assert.match(
    PROPERTY_CARD_SRC,
    eitherPattern,
    'isQualifiedDeal must be combined with !isAuctionLike either at definition or use',
  );
});
