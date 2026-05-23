// Tests for the recent-searches-chips kill switch (#428 follow-up).
//
// The chip UI rolled out in #428 was un-flagged. Reviewer asked for the
// standard flag-first rollout. This module is the pure-JS predicate that
// the React layer consults via useFeatureFlag.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RECENT_SEARCHES_CHIPS_FLAG,
  isRecentSearchesChipsEnabled,
} from '../searchHistoryFlag.js';

test('RECENT_SEARCHES_CHIPS_FLAG is the canonical slug for the kill switch', () => {
  // Frozen so a refactor cannot silently rename and disable the gate.
  assert.equal(RECENT_SEARCHES_CHIPS_FLAG, 'recent-searches-chips');
});

test('isRecentSearchesChipsEnabled: false when result is undefined (hook not yet rendered)', () => {
  assert.equal(isRecentSearchesChipsEnabled(undefined), false);
});

test('isRecentSearchesChipsEnabled: false when still loading (loading=true, enabled=false)', () => {
  // Defaults the hook returns before the first fetch resolves. Treat as off.
  assert.equal(isRecentSearchesChipsEnabled({ enabled: false, loading: true }), false);
});

test('isRecentSearchesChipsEnabled: false when DB row is off (loading=false, enabled=false)', () => {
  assert.equal(isRecentSearchesChipsEnabled({ enabled: false, loading: false }), false);
});

test('isRecentSearchesChipsEnabled: true ONLY when enabled is explicit true', () => {
  assert.equal(isRecentSearchesChipsEnabled({ enabled: true, loading: false }), true);
  // Truthy non-true should not pass — guards against accidental coercion.
  assert.equal(isRecentSearchesChipsEnabled({ enabled: 'true', loading: false }), false);
  assert.equal(isRecentSearchesChipsEnabled({ enabled: 1, loading: false }), false);
  assert.equal(isRecentSearchesChipsEnabled({ enabled: {}, loading: false }), false);
});

test('isRecentSearchesChipsEnabled: false when arg is null or not an object', () => {
  assert.equal(isRecentSearchesChipsEnabled(null), false);
  assert.equal(isRecentSearchesChipsEnabled('on'), false);
  assert.equal(isRecentSearchesChipsEnabled(true), false);
});
