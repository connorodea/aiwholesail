// Tests for auction-subject detection used by ComparableSalesTable.
// Detects foreclosure/auction listings so the UI doesn't show a misleading
// "Great Deal +$X" verdict against a non-market opening bid.
//
// Rework of stale PR #94. The original PR embedded this logic inline in
// the React component. Extracting to a pure module so we can:
//   - unit-test the detection rules in isolation
//   - reuse from server-side enrichment or alert workers later
//   - keep the component file focused on rendering, not classification
//
// Plain JS / ESM so node:test can run without a transpiler — matches
// comps-similarity.js (PR #371), comps-location-parser.js (PR #380).
//
// Run:
//   node --test src/lib/__tests__/auction-detection.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { isAuctionSubject } from '../auction-detection.js';

test('detects "foreclosure auction" in description (case-insensitive)', () => {
  for (const desc of [
    'Foreclosure Auction starting March 15',
    'FORECLOSURE AUCTION',
    'foreclosure auction',
    'Property going to foreclosure auction next month',
  ]) {
    assert.equal(isAuctionSubject({ description: desc }), true, `should detect: ${desc}`);
  }
});

test('detects "opening bid" in description', () => {
  for (const desc of [
    'Opening bid $1,000',
    'opening BID',
    'The opening bid is set at the appraised value',
  ]) {
    assert.equal(isAuctionSubject({ description: desc }), true, `should detect: ${desc}`);
  }
});

test('detects "trustee\'s sale" with or without apostrophe', () => {
  // Real-world: trustee sale notices appear with and without the
  // possessive apostrophe depending on the source (MLS, county recorder,
  // listing agent). Regex must match both.
  for (const desc of [
    "Trustee's Sale on May 1",
    'Trustees Sale on May 1',
    'TRUSTEE\'S SALE',
    'trustees sale',
  ]) {
    assert.equal(isAuctionSubject({ description: desc }), true, `should detect: ${desc}`);
  }
});

test('detects "sheriff\'s sale" with or without apostrophe', () => {
  for (const desc of [
    "Sheriff's Sale auction",
    'Sheriffs Sale auction',
    'SHERIFF\'S SALE',
  ]) {
    assert.equal(isAuctionSubject({ description: desc }), true, `should detect: ${desc}`);
  }
});

test('low PPSF (price/sqft < $10) indicates an auction opening bid', () => {
  // Heuristic: a real listing under $10/sqft is essentially unheard of
  // in 2026 US market. When PPSF gets this low, the "price" is almost
  // always an opening bid or a placeholder. The PPSF threshold catches
  // auction subjects where the description didn't include the keywords.
  assert.equal(isAuctionSubject({ price: 1000, sqft: 1500 }), true, 'PPSF $0.67 = auction');
  assert.equal(isAuctionSubject({ price: 12000, sqft: 1500 }), true, 'PPSF $8 = auction');
  assert.equal(isAuctionSubject({ price: 14999, sqft: 1500 }), true, 'PPSF $9.99 = auction');
});

test('low absolute price + decent sqft also catches auctions', () => {
  // Belt-and-suspenders: <$25k price + >800 sqft is rare for non-auction
  // listings even in low-cost-of-living markets. Catches auctions where
  // the PPSF calculation hits the edge of the <$10 threshold but the
  // structural signal is still suspicious.
  assert.equal(isAuctionSubject({ price: 20000, sqft: 1200 }), true);
  assert.equal(isAuctionSubject({ price: 5000, sqft: 900 }), true);
  // Edge: exactly $25k boundary → not auction (heuristic is strictly <25k)
  assert.equal(isAuctionSubject({ price: 25000, sqft: 1200 }), false);
});

test('normal listing returns false', () => {
  // Median single-family in most US markets is $200-500k. None of these
  // signals should fire.
  assert.equal(isAuctionSubject({
    price: 350000,
    sqft: 1800,
    description: 'Beautiful 3-bedroom home with updated kitchen and large backyard',
  }), false);

  assert.equal(isAuctionSubject({
    price: 125000,
    sqft: 1200,
    description: 'Fixer-upper opportunity in established neighborhood',
  }), false);
});

test('missing fields do not crash, return false', () => {
  // Defensive: ComparableSalesTable can receive partial data when a
  // property record is missing fields. The detection must degrade
  // gracefully — no exceptions, just "not detected as auction".
  assert.equal(isAuctionSubject({}), false);
  assert.equal(isAuctionSubject({ price: null, sqft: null, description: null }), false);
  assert.equal(isAuctionSubject({ price: 0, sqft: 0 }), false);
  assert.equal(isAuctionSubject(null), false);
  assert.equal(isAuctionSubject(undefined), false);
});

test('typo "federa home" in description detects (Federal Home Loan REO listings)', () => {
  // Documented quirk inherited from stale PR #94: the original regex
  // included "federa home" — likely catching "Federal Home Loan Mortgage"
  // strings in REO listings where the description got truncated or
  // OCR'd badly. Preserving the behavior; if this turns out to be wrong
  // we can drop it in a future PR.
  assert.equal(isAuctionSubject({
    description: 'Property sold by Federa Home Loan Mortgage Corp',
  }), true);
});

test('returns false for description-only listings without auction keywords', () => {
  // A property with description but no auction signals + no low PPSF + no
  // low absolute price should NOT be detected. This counter-test prevents
  // regex over-matching (e.g., "great auction-style kitchen" should not fire).
  assert.equal(isAuctionSubject({
    price: 350000,
    sqft: 1800,
    description: 'This auction-style kitchen has beautiful cabinets',
  }), false, '"auction-style" alone should not trigger');
});

test('function is pure: same input always returns same output', () => {
  const input = {
    price: 12000,
    sqft: 1500,
    description: 'Foreclosure auction',
  };
  const a = isAuctionSubject(input);
  const b = isAuctionSubject(input);
  assert.equal(a, b);
  assert.equal(a, true);
});
