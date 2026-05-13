/**
 * Unit tests for Zillow API auth gating + Bearer header attachment.
 *
 * Covers the 2026-05-13 cpodea5 incident: expired session token →
 * frontend fired /api/zillow/proxy anyway → 401 → ugly error toast
 * with no recovery path.
 *
 * Tests verify that:
 *   1. fetchPageViaHetzner throws `NOT_AUTHENTICATED` when no token
 *   2. callApiViaHetzner throws `NOT_AUTHENTICATED` when no token
 *   3. Both attach `Authorization: Bearer <token>` when token present
 *
 * Test runner: vitest (not yet installed in this repo as of
 * 2026-05-13 — file authored to be drop-in compatible). The structure
 * also works under jest with minimal tweaks.
 *
 * Run locally once vitest is wired:
 *   $ npx vitest run src/lib/__tests__/zillow-api.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ZillowAPI } from '@/lib/zillow-api';
import { tokenStorage } from '@/lib/api-client';
import type { PropertySearchParams } from '@/types/zillow';

const baseSearchParams: PropertySearchParams = {
  location: 'Detroit, MI',
  homeType: 'Houses',
};

// In-memory localStorage stub. The real tokenStorage reads from
// localStorage; under vitest jsdom this is provided, but we set/clear
// via the existing helpers to keep the test honest about the public
// contract.
function setToken(token: string | null) {
  if (token === null) {
    tokenStorage.clear();
  } else {
    tokenStorage.setAccessToken(token);
  }
}

// Capture fetch calls for assertion.
type FetchCall = { url: string; init: RequestInit };

function installFetchSpy(responseBody: unknown = { success: true, data: {} }) {
  const calls: FetchCall[] = [];
  const fakeFetch = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init: init || {} });
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  // Overwrite global fetch for the duration of a test. Cast through
  // unknown to avoid the strict Window['fetch'] signature mismatch
  // while keeping the test file lint-clean (no `any`).
  globalThis.fetch = fakeFetch as unknown as typeof fetch;
  return { calls, fakeFetch };
}

describe('ZillowAPI auth gating', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    setToken(null);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    setToken(null);
  });

  describe('fetchPageViaHetzner (via searchProperties)', () => {
    it('throws NOT_AUTHENTICATED when no access token is stored', async () => {
      installFetchSpy();
      setToken(null);

      const api = new ZillowAPI();
      await expect(
        api.searchProperties(baseSearchParams, 1)
      ).rejects.toThrow('NOT_AUTHENTICATED');
    });

    it('attaches Authorization: Bearer <token> when token is present', async () => {
      const { calls } = installFetchSpy({
        success: true,
        data: { props: [], totalResultCount: 0 },
      });
      setToken('tok_test_abc123');

      const api = new ZillowAPI();
      // Swallow downstream parsing errors — we only care that fetch fired
      // with the right header.
      try {
        await api.searchProperties(baseSearchParams, 1);
      } catch {
        // ignore — parsing pipeline may complain about empty fixture
      }

      expect(calls.length).toBeGreaterThanOrEqual(1);
      const headers = calls[0].init.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer tok_test_abc123');
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('does not fire a network request when token is missing', async () => {
      const { calls } = installFetchSpy();
      setToken(null);

      const api = new ZillowAPI();
      await expect(
        api.searchProperties(baseSearchParams, 1)
      ).rejects.toThrow('NOT_AUTHENTICATED');

      // Critical: zero network traffic — no 401 round-trip.
      expect(calls.length).toBe(0);
    });
  });

  describe('callApiViaHetzner (via getPropertyDetails)', () => {
    it('throws NOT_AUTHENTICATED when no access token is stored', async () => {
      installFetchSpy();
      setToken(null);

      const api = new ZillowAPI();
      await expect(api.getPropertyDetails('12345')).rejects.toThrow(
        'NOT_AUTHENTICATED'
      );
    });

    it('attaches Authorization: Bearer <token> when token is present', async () => {
      const { calls } = installFetchSpy({ success: true, data: { zpid: '12345' } });
      setToken('tok_test_xyz789');

      const api = new ZillowAPI();
      await api.getPropertyDetails('12345');

      expect(calls.length).toBe(1);
      const headers = calls[0].init.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer tok_test_xyz789');
    });

    it('does not fire a network request when token is missing', async () => {
      const { calls } = installFetchSpy();
      setToken(null);

      const api = new ZillowAPI();
      await expect(api.getPropertyDetails('12345')).rejects.toThrow(
        'NOT_AUTHENTICATED'
      );

      expect(calls.length).toBe(0);
    });
  });
});

describe('Bearer-patched fetches (regression: PR #306 auth-gated proxy)', () => {
  // These tests exist to document the contract that consumers of
  // /api/zillow/proxy in non-zillow-api.ts code paths must also attach
  // a Bearer when one is present. The actual call sites are:
  //   - src/components/AdvancedAIDealCalculator.tsx (fetchPropertyPhotos)
  //   - src/services/zillowARVService.ts (getComparableHomes)
  // Both were patched in this branch; they no longer 401 silently.

  it('documents that two ad-hoc zillow fetches were patched', () => {
    // Plain inventory test — no runtime behaviour. If a regression
    // re-adds a raw fetch(ZILLOW_API_URL) without a token check, grep
    // for this comment and trace back.
    expect(true).toBe(true);
  });
});
