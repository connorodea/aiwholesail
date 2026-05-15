// Tests for composeFullAddress — the small pure function that decides
// what string lands in Property.address.
//
// Why this exists as its own module: skip-trace breakage (PR #457). The
// frontend's flattenProperty was reading city/state/zip from the wrong
// keys when search results came back from the scrape.do path, so
// Property.address arrived as a bare street. Downstream code that
// splits on comma to derive citystatezip (useSkipTrace.skipTraceProperty)
// silently short-circuited.
//
// These tests pin the field-name fallback chains so a future migration
// can't drop a key by accident.

import test from 'node:test';
import assert from 'node:assert/strict';
import { composeFullAddress } from '../zillow-address.js';

test('scrape.do search shape: addressCity/addressState/addressZipcode combine into a full address', () => {
  // Shape produced by lib/scrapers/zillowScrapeDo:mapListingToSummary
  // after flatten() runs over it (flatten leaves top-level scalars alone).
  const flattened = {
    address: '4100 Poplar Ave',
    addressStreet: '4100 Poplar Ave',
    addressCity: 'Memphis',
    addressState: 'TN',
    addressZipcode: '38111',
  };

  assert.equal(composeFullAddress(flattened), '4100 Poplar Ave, Memphis, TN 38111');
});

test('scrape.do search shape without zipcode: composes street, city, state', () => {
  const flattened = {
    addressStreet: '123 Main St',
    addressCity: 'Atlanta',
    addressState: 'GA',
  };

  assert.equal(composeFullAddress(flattened), '123 Main St, Atlanta, GA');
});

test('detail-endpoint shape: property_address_* keys still take precedence', () => {
  // RapidAPI / new-Zillow-Scraper-API detail response, after flatten()
  // mangles nested property.address.* into property_address_*.
  const flattened = {
    property_address_streetAddress: '777 Detail Way',
    property_address_city: 'Dallas',
    property_address_state: 'TX',
    property_address_zipcode: '75201',
    // scrape.do keys also present — must NOT override the more-specific
    // detail keys, since the detail endpoint is the authoritative source
    // when both are populated.
    addressCity: 'WRONG',
    addressState: 'WRONG',
  };

  assert.equal(composeFullAddress(flattened), '777 Detail Way, Dallas, TX 75201');
});

test('legacy fallback chain (plain city/state) still works', () => {
  const flattened = {
    address: '500 Old Path Rd',
    city: 'Cleveland',
    state: 'OH',
    zipcode: '44101',
  };

  assert.equal(composeFullAddress(flattened), '500 Old Path Rd, Cleveland, OH 44101');
});

test('street-only input falls back to street (no comma) — same as current behavior', () => {
  // We don't want to fabricate citystatezip when it's genuinely missing —
  // downstream callers can decide to error. This guards against a future
  // change that tries to "be helpful" by appending an empty ", ," tail.
  const flattened = {
    address: '999 Lonely Ln',
  };

  const result = composeFullAddress(flattened);
  assert.equal(result, '999 Lonely Ln');
  assert.equal(result.includes(','), false);
});

test('missing address entirely falls back to "Unknown Address"', () => {
  assert.equal(composeFullAddress({}), 'Unknown Address');
});
