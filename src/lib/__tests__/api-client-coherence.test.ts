// @vitest-environment jsdom

/**
 * Unit tests for the auth-coherence check in api-client's
 * onAuthStateChange.
 *
 * Pins the fix for the cpodea5 2026-05-14 incident: a "zombie session"
 * where localStorage carries a user record but no access token. Before
 * this fix, AuthContext would render the user as logged in indefinitely
 * while every API call threw NOT_AUTHENTICATED — the user was trapped
 * on a broken page with no recovery path except manually clearing
 * site storage.
 *
 * The fix: onAuthStateChange now coherence-checks the storage state
 * before notifying subscribers. If user exists without an access token,
 * the entire auth bundle is cleared and the callback receives null.
 *
 * Run:
 *   $ npx vitest run src/lib/__tests__/api-client-coherence.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { onAuthStateChange, tokenStorage } from '@/lib/api-client';
import type { User } from '@/lib/api-client';

const SAMPLE_USER: User = {
  id: 'usr_test',
  email: 'test@example.com',
  fullName: 'Test User',
};

describe('onAuthStateChange — coherence check', () => {
  beforeEach(() => {
    tokenStorage.clear();
  });

  it('emits the user when both user and access token are present', () => {
    tokenStorage.setUser(SAMPLE_USER);
    tokenStorage.setAccessToken('valid-jwt');

    let received: User | null = SAMPLE_USER;
    const unsubscribe = onAuthStateChange((u) => {
      received = u;
    });

    expect(received?.id).toBe('usr_test');
    unsubscribe();
  });

  it('emits null when user is stored but access token is missing (zombie session)', () => {
    // The exact state from the cpodea5 2026-05-14 incident.
    tokenStorage.setUser(SAMPLE_USER);
    // NO setAccessToken — simulating storage eviction / partial clear / etc.

    let received: User | null = SAMPLE_USER;
    const unsubscribe = onAuthStateChange((u) => {
      received = u;
    });

    expect(received).toBeNull();
    unsubscribe();
  });

  it('clears the stale user when in the zombie state — self-heals', () => {
    tokenStorage.setUser(SAMPLE_USER);

    const unsubscribe = onAuthStateChange(() => {
      /* no-op — we only care about the side effect */
    });

    expect(tokenStorage.getUser()).toBeNull();
    unsubscribe();
  });

  it('emits null cleanly when storage is entirely empty', () => {
    let received: User | null = SAMPLE_USER;
    const unsubscribe = onAuthStateChange((u) => {
      received = u;
    });

    expect(received).toBeNull();
    unsubscribe();
  });

  it('does NOT clear storage when both user and token are present', () => {
    tokenStorage.setUser(SAMPLE_USER);
    tokenStorage.setAccessToken('valid-jwt');

    const unsubscribe = onAuthStateChange(() => {
      /* no-op */
    });

    expect(tokenStorage.getUser()?.id).toBe('usr_test');
    expect(tokenStorage.getAccessToken()).toBe('valid-jwt');
    unsubscribe();
  });
});
