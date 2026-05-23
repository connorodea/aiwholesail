// Source-introspection test for the ComparableSalesTable auction
// gating across all four green-styling sites.
//
// Why this exists (gap surfaced 2026-05-15 after PR #408/#430/#433/#437):
//
//   PR #408 gated the "Great Deal" Badge on isAuctionLike, but the
//   surrounding green card styling was NOT gated. An auction subject
//   still renders with:
//     - emerald-tinted card background
//     - green check icon
//     - green text color on the +$295K dollar amount
//     - "Profitable Deal Confirmed" green callout at the bottom
//   …with a small amber "Auction subject" note tucked under the green
//   bold number. The visual signal is contradictory; a wholesaler
//   glancing at the card sees GREEN +$295K and may miss the warning.
//
//   This PR extracts a single computed boolean `qualifiedDealStyling =
//   spreadFromComps > 30000 && !isAuctionLike` and uses it everywhere
//   green styling is applied. Auction subjects then render with neutral
//   theming + amber warning — no contradiction.
//
// Source-introspection style — pinning the wiring without running React.
//
// Run:
//   node --test src/lib/__tests__/comps-table-auction-gate.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(
  join(__dirname, '..', '..', 'components', 'ComparableSalesTable.tsx'),
  'utf8',
);

test('ComparableSalesTable: introduces a single qualifiedDealStyling boolean', () => {
  // The fix introduces a named computed boolean. This keeps the four
  // call sites in sync — change the threshold once, change everywhere.
  assert.match(
    SRC,
    /const\s+qualifiedDealStyling\s*=\s*spreadFromComps\s*>\s*30000\s*&&\s*!isAuctionLike/,
    'must define qualifiedDealStyling combining spread + !isAuctionLike',
  );
});

test('ComparableSalesTable: card background uses qualifiedDealStyling (not raw spread)', () => {
  // Was: `spreadFromComps > 30000 ? 'from-green-500/10 ...'`
  // Now: `qualifiedDealStyling ? 'from-green-500/10 ...'`
  // Auction subject must NOT get the emerald-tinted gradient.
  const cardGradientMatch = SRC.match(
    /Card className=\{`bg-gradient-to-br \$\{([^?]+)\?\s*'from-green-500\/10[^']*'/,
  );
  assert.ok(cardGradientMatch, 'card gradient ternary must exist');
  const condition = cardGradientMatch[1].trim();
  assert.equal(
    condition,
    'qualifiedDealStyling',
    'card gradient must gate on qualifiedDealStyling',
  );
});

test('ComparableSalesTable: check icon color uses qualifiedDealStyling', () => {
  // The CheckCircle2 icon next to "Spread vs ARV" — green when
  // qualified, neutral when not.
  const iconMatch = SRC.match(
    /CheckCircle2 className=\{`h-4 w-4 \$\{([^?]+)\?\s*'text-green-500'/,
  );
  assert.ok(iconMatch, 'check-icon ternary must exist');
  assert.equal(iconMatch[1].trim(), 'qualifiedDealStyling');
});

test('ComparableSalesTable: dollar-amount text color uses qualifiedDealStyling', () => {
  // The +$295K big bold number. Was green-on-spread; now green-only-when-not-auction.
  const dollarMatch = SRC.match(
    /text-xl font-bold \$\{([^?]+)\?\s*'text-green-500'[^']*:\s*spreadFromComps\s*>\s*0/,
  );
  assert.ok(dollarMatch, 'dollar-text ternary must exist');
  assert.equal(dollarMatch[1].trim(), 'qualifiedDealStyling');
});

test('ComparableSalesTable: bottom "Profitable Deal Confirmed" callout gated on auction', () => {
  // The bottom analysis card — title "Profitable Deal Confirmed" with
  // green check icon. Must not render for auction subjects.
  // Looking for: `{comparables.length > 0 && qualifiedDealStyling && (`
  // OR equivalent — at minimum, !isAuctionLike must be in the conditional.
  const calloutPattern =
    /comparables\.length\s*>\s*0\s*&&\s*(qualifiedDealStyling|spreadFromComps\s*>\s*30000\s*&&\s*!isAuctionLike)\s*&&/;
  assert.match(
    SRC,
    calloutPattern,
    '"Profitable Deal Confirmed" card conditional must include !isAuctionLike',
  );
});

test('ComparableSalesTable: existing "Great Deal" badge gate preserved', () => {
  // Regression guard — the PR #408 fix must remain intact.
  assert.match(
    SRC,
    /spreadFromComps\s*>\s*50000\s*&&\s*!isAuctionLike/,
    'the original PR #408 Great-Deal-badge gate must remain',
  );
});
