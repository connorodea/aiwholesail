// Tests for cross-tab auth-coherence helpers.
//
// Why this exists (recurring zombie-session incident, May 2026):
//
//   PR #376 self-heals zombie sessions at MOUNT time — `onAuthStateChange`
//   coherence-checks the storage state when a listener registers, and
//   emits null + clears storage if user is present without an access
//   token. That fix only runs ONCE per page load.
//
//   The bug recurred on 2026-05-14 because the zombie state can develop
//   AFTER mount: a parallel tab signs out, an iOS Safari ITP eviction
//   drops the access-token key, or DevTools manually removes it. The
//   tab carrying the React `user` state has no listener for those
//   events, so the next API call (the user clicking "Search Properties"
//   in the screenshot) sees a null token and throws NOT_AUTHENTICATED —
//   surfacing as "Your session has expired. Please sign in to search."
//
//   Fix: a `storage` event listener that detects when an auth-critical
//   localStorage key is removed in another tab/context and pushes
//   `notifyAuthChange(null)` immediately. The React user state goes
//   null, ProtectedRoute redirects to /auth, and the user lands on a
//   clean sign-in flow instead of a broken page with a toast.
//
//   The helpers here are pure JS so they unit-test with `node --test` —
//   the existing TS/vitest coherence test (PR #376) doesn't actually
//   run in CI (no vitest in scripts/). Pattern matches
//   auction-detection.js (PR #408), comps-similarity.js (PR #371),
//   comps-location-parser.js (PR #380).
//
// Run:
//   node --test src/lib/__tests__/auth-coherence.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAuthCriticalKey,
  shouldClearOnStorageEvent,
  AUTH_STORAGE_KEYS,
} from '../auth-coherence.js';

test('AUTH_STORAGE_KEYS exports the three auth-critical localStorage keys', () => {
  // Contract: any change here is a deliberate update to which keys
  // gate the auth-coherence check. Match api-client.ts constants.
  assert.equal(AUTH_STORAGE_KEYS.ACCESS_TOKEN, 'aiwholesail_access_token');
  assert.equal(AUTH_STORAGE_KEYS.REFRESH_TOKEN, 'aiwholesail_refresh_token');
  assert.equal(AUTH_STORAGE_KEYS.USER, 'aiwholesail_user');
});

test('isAuthCriticalKey: returns true for the three auth keys', () => {
  assert.equal(isAuthCriticalKey('aiwholesail_access_token'), true);
  assert.equal(isAuthCriticalKey('aiwholesail_refresh_token'), true);
  assert.equal(isAuthCriticalKey('aiwholesail_user'), true);
});

test('isAuthCriticalKey: returns false for unrelated keys', () => {
  assert.equal(isAuthCriticalKey('aiwholesail_subscription_cache'), false);
  assert.equal(isAuthCriticalKey('selectedPlan'), false);
  assert.equal(isAuthCriticalKey('attribution'), false);
  assert.equal(isAuthCriticalKey(''), false);
  assert.equal(isAuthCriticalKey(null), false);
  assert.equal(isAuthCriticalKey(undefined), false);
});

test('shouldClearOnStorageEvent: true when access token is removed in another tab', () => {
  // Cross-tab signout: Tab A calls signOut, Tab B sees the storage event
  // with key=access_token, newValue=null. Tab B should clear its React
  // user state immediately.
  const event = {
    key: 'aiwholesail_access_token',
    oldValue: 'valid-jwt-blob',
    newValue: null,
  };
  assert.equal(shouldClearOnStorageEvent(event), true);
});

test('shouldClearOnStorageEvent: true when user record is removed', () => {
  const event = {
    key: 'aiwholesail_user',
    oldValue: '{"id":"usr_test","email":"a@b.com"}',
    newValue: null,
  };
  assert.equal(shouldClearOnStorageEvent(event), true);
});

test('shouldClearOnStorageEvent: true when refresh token is removed', () => {
  // Refresh token alone isn't enough to render UI as auth'd, but losing
  // it means the next AT-expiry can't be recovered silently. Treat its
  // removal as a sign of a deliberate clear (signout, account delete)
  // and tear down React state to match.
  const event = {
    key: 'aiwholesail_refresh_token',
    oldValue: 'rt-blob',
    newValue: null,
  };
  assert.equal(shouldClearOnStorageEvent(event), true);
});

test('shouldClearOnStorageEvent: true when key=null (full localStorage.clear)', () => {
  // The `storage` event fires once with `key=null` when localStorage.clear()
  // is called in another tab. That wipes ALL keys including the auth ones,
  // so we must treat it as a signout signal too. Without this branch,
  // a Tab A devtools "Clear storage" leaves Tab B in zombie state.
  const event = { key: null, oldValue: null, newValue: null };
  assert.equal(shouldClearOnStorageEvent(event), true);
});

test('shouldClearOnStorageEvent: false when a non-auth key changes', () => {
  // E.g., subscription cache invalidation, attribution capture, or a
  // selectedPlan write during the pricing flow. None of these should
  // tear down the auth state.
  const event = {
    key: 'aiwholesail_subscription_cache',
    oldValue: 'stale',
    newValue: 'fresh',
  };
  assert.equal(shouldClearOnStorageEvent(event), false);
});

test('shouldClearOnStorageEvent: false when an auth key is SET (not removed)', () => {
  // Sign-in in another tab: AT key gets a new value. This is a positive
  // event, not a signout signal. We don't want to push null and force
  // the user back to /auth — they just signed in elsewhere.
  // The mount-time getCoherentUser() will pick up the new tokens on
  // next navigation; we don't need to react to the set event here.
  const event = {
    key: 'aiwholesail_access_token',
    oldValue: null,
    newValue: 'new-jwt-blob',
  };
  assert.equal(shouldClearOnStorageEvent(event), false);
});

test('shouldClearOnStorageEvent: false when an auth key is REPLACED (rotation)', () => {
  // Refresh-token rotation: doRefresh() writes a new AT + new RT. The
  // storage event fires with oldValue=old-jwt, newValue=new-jwt. This
  // is NOT a signout — it's the happy path. Must not clear.
  const event = {
    key: 'aiwholesail_access_token',
    oldValue: 'old-jwt',
    newValue: 'rotated-jwt',
  };
  assert.equal(shouldClearOnStorageEvent(event), false);
});

test('shouldClearOnStorageEvent: false on null/undefined event (defensive)', () => {
  // The `storage` event listener should never be called without an event,
  // but defensive helpers don't crash the page if it happens (e.g.,
  // dispatchEvent in a test, malformed polyfill).
  assert.equal(shouldClearOnStorageEvent(null), false);
  assert.equal(shouldClearOnStorageEvent(undefined), false);
  assert.equal(shouldClearOnStorageEvent({}), false);
});

test('shouldClearOnStorageEvent: same-key set with newValue="" treated as removal', () => {
  // Browsers normalize localStorage.removeItem to a storage event with
  // newValue=null, but some quota-eviction paths emit newValue="" (empty
  // string) instead. Treat empty-string as a removal too — a zero-length
  // access token is non-functional anyway.
  const event = {
    key: 'aiwholesail_access_token',
    oldValue: 'valid-jwt',
    newValue: '',
  };
  assert.equal(shouldClearOnStorageEvent(event), true);
});
