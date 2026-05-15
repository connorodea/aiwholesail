// Tests for the brand-flag kill switch (#413 follow-up).
//
// PR #413 globally bumped body to font-bold and headings to font-extrabold
// without a feature-flag kill switch. Reviewer asked for the standard
// flag-first rollout. This module adds the predicate + init helper so the
// brand-bold weights can be toggled at the DB level without a redeploy.
//
// The CSS rules in src/index.css are scoped to `html[data-brand-bold="true"]`
// so when the attribute is absent (default), the site reverts to the
// pre-#413 appearance.
//
// Pure JS + node --test, matching the project pattern.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BRAND_BOLD_FLAG,
  isBrandBoldEnabled,
  applyBrandBoldAttribute,
} from '../brand-flags.js';

test('BRAND_BOLD_FLAG is the canonical slug for the kill switch', () => {
  // Frozen so a refactor cannot silently rename and disable the gate.
  assert.equal(BRAND_BOLD_FLAG, 'brand-bold');
});

test('isBrandBoldEnabled: false when flag-getter returns undefined (cold cache)', () => {
  assert.equal(isBrandBoldEnabled(() => undefined), false);
});

test('isBrandBoldEnabled: false when flag-getter returns false', () => {
  assert.equal(isBrandBoldEnabled(() => false), false);
});

test('isBrandBoldEnabled: true ONLY when flag-getter returns explicit true', () => {
  assert.equal(isBrandBoldEnabled(() => true), true);
  assert.equal(isBrandBoldEnabled(() => 'true'), false);
  assert.equal(isBrandBoldEnabled(() => 1), false);
  assert.equal(isBrandBoldEnabled(() => ({})), false);
});

test('isBrandBoldEnabled: false when flag-getter throws (fail closed)', () => {
  assert.equal(
    isBrandBoldEnabled(() => {
      throw new Error('cache corrupt');
    }),
    false,
  );
});

test('isBrandBoldEnabled: false when getter is missing or not a function', () => {
  assert.equal(isBrandBoldEnabled(null), false);
  assert.equal(isBrandBoldEnabled(undefined), false);
  assert.equal(isBrandBoldEnabled('nope'), false);
});

test('applyBrandBoldAttribute: sets data-brand-bold="true" on element when flag on', () => {
  const fakeEl = {
    attrs: new Map(),
    setAttribute(k, v) { this.attrs.set(k, v); },
    removeAttribute(k) { this.attrs.delete(k); },
  };
  applyBrandBoldAttribute(fakeEl, () => true);
  assert.equal(fakeEl.attrs.get('data-brand-bold'), 'true');
});

test('applyBrandBoldAttribute: removes data-brand-bold when flag off', () => {
  const fakeEl = {
    attrs: new Map([['data-brand-bold', 'true']]),
    setAttribute(k, v) { this.attrs.set(k, v); },
    removeAttribute(k) { this.attrs.delete(k); },
  };
  applyBrandBoldAttribute(fakeEl, () => false);
  assert.equal(fakeEl.attrs.has('data-brand-bold'), false);
});

test('applyBrandBoldAttribute: removes attribute on cold cache (default OFF)', () => {
  const fakeEl = {
    attrs: new Map([['data-brand-bold', 'true']]),
    setAttribute(k, v) { this.attrs.set(k, v); },
    removeAttribute(k) { this.attrs.delete(k); },
  };
  applyBrandBoldAttribute(fakeEl, () => undefined);
  assert.equal(fakeEl.attrs.has('data-brand-bold'), false);
});

test('applyBrandBoldAttribute: no-op on null element (defensive)', () => {
  assert.doesNotThrow(() => applyBrandBoldAttribute(null, () => true));
  assert.doesNotThrow(() => applyBrandBoldAttribute(undefined, () => true));
});
