// Kill-switch tests for the comps-filter UI rollout.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPS_FILTER_CONTROLS_FLAG,
  isCompsFilterControlsEnabled,
} from '../compsFilterFlag.js';

test('COMPS_FILTER_CONTROLS_FLAG is the canonical slug', () => {
  assert.equal(COMPS_FILTER_CONTROLS_FLAG, 'comps-filter-controls');
});

test('isCompsFilterControlsEnabled: false on undefined / loading / DB-off / non-object / strict-true coercion', () => {
  assert.equal(isCompsFilterControlsEnabled(undefined), false);
  assert.equal(isCompsFilterControlsEnabled(null), false);
  assert.equal(isCompsFilterControlsEnabled('on'), false);
  assert.equal(isCompsFilterControlsEnabled({ enabled: false, loading: true }), false);
  assert.equal(isCompsFilterControlsEnabled({ enabled: false, loading: false }), false);
  assert.equal(isCompsFilterControlsEnabled({ enabled: 'true', loading: false }), false);
  assert.equal(isCompsFilterControlsEnabled({ enabled: 1, loading: false }), false);
});

test('isCompsFilterControlsEnabled: true ONLY when enabled === true', () => {
  assert.equal(isCompsFilterControlsEnabled({ enabled: true, loading: false }), true);
});
