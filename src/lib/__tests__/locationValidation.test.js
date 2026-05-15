// TDD: tests for the location-validation helpers extracted from
// RealEstateWholesaler.tsx so PropertySearch (and any future call site)
// can apply the same rejection rules pre-search.
//
// Run:
//   node --test src/lib/__tests__/locationValidation.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isCountyWithoutState,
  isStateOnlyLocation,
} from '../locationValidation.js';

test('non-county locations: returns false', () => {
  assert.equal(isCountyWithoutState('Detroit, MI'), false);
  assert.equal(isCountyWithoutState('48201'), false);
  assert.equal(isCountyWithoutState('Michigan'), false);
  assert.equal(isCountyWithoutState(''), false);
});

test('county with full state name: returns false', () => {
  assert.equal(isCountyWithoutState('Oakland County, Michigan'), false);
  assert.equal(isCountyWithoutState('Wayne County, michigan'), false);
});

test('county with state abbreviation: returns false', () => {
  assert.equal(isCountyWithoutState('Oakland County, MI'), false);
  assert.equal(isCountyWithoutState('Wayne County, mi'), false);
});

test('county with state and country: returns false', () => {
  assert.equal(isCountyWithoutState('Oakland County, MI, USA'), false);
  assert.equal(isCountyWithoutState('Oakland County, Michigan, United States'), false);
});

test('plain county (no state): returns true', () => {
  assert.equal(isCountyWithoutState('Oakland County'), true);
  assert.equal(isCountyWithoutState('Wayne County'), true);
  assert.equal(isCountyWithoutState('oakland county'), true);
});

test('county with non-state garbage after the comma: returns true', () => {
  assert.equal(isCountyWithoutState('Oakland County, foo'), true);
  assert.equal(isCountyWithoutState('Oakland County, ZZ'), true);
});

test('county with country only (no state): returns true', () => {
  assert.equal(isCountyWithoutState('Oakland County, USA'), true);
  assert.equal(isCountyWithoutState('Oakland County, United States'), true);
});

test('handles surrounding whitespace and mixed case', () => {
  assert.equal(isCountyWithoutState('  Oakland County, MI  '), false);
  assert.equal(isCountyWithoutState('OAKLAND COUNTY, mi'), false);
  assert.equal(isCountyWithoutState('  oakland county  '), true);
});

test('isStateOnlyLocation: full state name returns true', () => {
  assert.equal(isStateOnlyLocation('Michigan'), true);
  assert.equal(isStateOnlyLocation('michigan'), true);
  assert.equal(isStateOnlyLocation('  Michigan  '), true);
  assert.equal(isStateOnlyLocation('New York'), true);
});

test('isStateOnlyLocation: 2-letter state abbreviation returns true', () => {
  assert.equal(isStateOnlyLocation('MI'), true);
  assert.equal(isStateOnlyLocation('mi'), true);
  assert.equal(isStateOnlyLocation('NY'), true);
});

test('isStateOnlyLocation: "State, United States" form returns true', () => {
  assert.equal(isStateOnlyLocation('Michigan, United States'), true);
  assert.equal(isStateOnlyLocation('Michigan, USA'), true);
  assert.equal(isStateOnlyLocation('Michigan, US'), true);
});

test('isStateOnlyLocation: city/county/ZIP returns false', () => {
  assert.equal(isStateOnlyLocation('Detroit, MI'), false);
  assert.equal(isStateOnlyLocation('Oakland County, MI'), false);
  assert.equal(isStateOnlyLocation('48201'), false);
  assert.equal(isStateOnlyLocation(''), false);
});

test('isStateOnlyLocation: non-state 2-letter code returns false', () => {
  assert.equal(isStateOnlyLocation('ZZ'), false);
  assert.equal(isStateOnlyLocation('XX'), false);
});
