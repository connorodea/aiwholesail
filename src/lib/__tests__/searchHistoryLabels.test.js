// Unit tests for the pure label-builder helpers used by SearchHistory chips.
//
// Run:
//   node --test src/lib/__tests__/searchHistoryLabels.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOnMarketHistoryLabel,
  buildOffMarketHistoryLabel,
} from '../searchHistoryLabels.ts';

test('on-market label: minimal — just location', () => {
  const label = buildOnMarketHistoryLabel({ location: 'Detroit, MI' });
  assert.equal(label, 'Detroit, MI');
});

test('on-market label: empty location falls back to "Anywhere"', () => {
  assert.equal(buildOnMarketHistoryLabel({ location: '' }), 'Anywhere');
  assert.equal(buildOnMarketHistoryLabel({}), 'Anywhere');
});

test('on-market label: price range with both bounds', () => {
  const label = buildOnMarketHistoryLabel({
    location: 'Detroit, MI',
    price_min: '100000',
    price_max: '300000',
  });
  assert.equal(label, 'Detroit, MI · $100K–$300K');
});

test('on-market label: price min only renders "X+"', () => {
  const label = buildOnMarketHistoryLabel({
    location: 'Detroit, MI',
    price_min: '150000',
  });
  assert.equal(label, 'Detroit, MI · $150K+');
});

test('on-market label: price max only renders "≤X"', () => {
  const label = buildOnMarketHistoryLabel({
    location: 'Detroit, MI',
    price_max: '250000',
  });
  assert.equal(label, 'Detroit, MI · ≤$250K');
});

test('on-market label: large prices switch to millions', () => {
  const label = buildOnMarketHistoryLabel({
    location: 'Aspen, CO',
    price_min: '1500000',
    price_max: '3000000',
  });
  assert.equal(label, 'Aspen, CO · $1.5M–$3M');
});

test('on-market label: beds/baths/radius/tags compose', () => {
  const label = buildOnMarketHistoryLabel({
    location: '48201',
    radiusMi: 10,
    bed_min: 3,
    bathrooms: 2,
    wholesaleOnly: true,
    motivatedSellersOnly: true,
  });
  // Order: location, radius, price (none), beds, baths, tags
  assert.equal(label, '48201 · 10mi · 3+bd · 2+ba · wholesale+motivated');
});

test('on-market label: drops empty/zero price bounds', () => {
  const label = buildOnMarketHistoryLabel({
    location: 'Detroit, MI',
    price_min: '0',
    price_max: '',
  });
  assert.equal(label, 'Detroit, MI');
});

test('off-market label: minimal — location + lead type', () => {
  const label = buildOffMarketHistoryLabel({
    locationInput: '48201',
    selectedLeadTypes: ['absentee'],
  });
  assert.equal(label, '48201 · absentee');
});

test('off-market label: multiple lead types collapse to count', () => {
  const label = buildOffMarketHistoryLabel({
    locationInput: 'Detroit, MI',
    selectedLeadTypes: ['absentee', 'preforeclosure', 'tax-delinquent'],
  });
  assert.equal(label, 'Detroit, MI · 3 types');
});

test('off-market label: equity + tax + years held + recent-sale toggle compose', () => {
  const label = buildOffMarketHistoryLabel({
    locationInput: 'Oakland County, MI',
    selectedLeadTypes: ['absentee'],
    equityFilter: 'gte_60',
    taxDelinquentOnly: true,
    minYearsHeld: 10,
    excludeRecentSales: true,
  });
  assert.equal(
    label,
    'Oakland County, MI · absentee · ≥60% eq · tax-delq · ≥10yr held · no recent sales',
  );
});

test('off-market label: omits limit when 25 (default), shows when overridden', () => {
  const dft = buildOffMarketHistoryLabel({
    locationInput: '48201',
    selectedLeadTypes: ['absentee'],
    limit: 25,
  });
  assert.equal(dft, '48201 · absentee');

  const bigger = buildOffMarketHistoryLabel({
    locationInput: '48201',
    selectedLeadTypes: ['absentee'],
    limit: 100,
  });
  assert.equal(bigger, '48201 · absentee · 100');
});

test('off-market label: empty location falls back to "Anywhere"', () => {
  assert.equal(
    buildOffMarketHistoryLabel({ locationInput: '' }),
    'Anywhere',
  );
});
