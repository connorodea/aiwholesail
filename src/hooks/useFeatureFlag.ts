import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

/**
 * Feature flag hook.
 *
 * Fetches the resolved flag map for the current user from /api/flags once per
 * page-load and caches in module scope for 60s. All `useFeatureFlag(slug)`
 * calls within that window share the same fetch.
 *
 * Usage:
 *   const { enabled, loading } = useFeatureFlag('unified-search');
 *   if (loading) return <Skeleton />;
 *   return enabled ? <NewThing /> : <LegacyThing />;
 */

interface FlagMap {
  [slug: string]: boolean;
}

interface CacheEntry {
  flags: FlagMap;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60 * 1000;
let cache: CacheEntry | null = null;
let inflight: Promise<FlagMap> | null = null;

const listeners = new Set<(flags: FlagMap) => void>();

function notify(flags: FlagMap) {
  listeners.forEach((cb) => cb(flags));
}

async function fetchFlags(): Promise<FlagMap> {
  // De-dup concurrent calls — multiple hooks mounting in the same render
  // collapse to one network round-trip.
  if (inflight) return inflight;
  inflight = (async () => {
    const res = await apiFetch<{ flags: FlagMap }>('/api/flags');
    const flags = res.data?.flags ?? {};
    cache = { flags, fetchedAt: Date.now() };
    notify(flags);
    inflight = null;
    return flags;
  })();
  return inflight;
}

function getCached(): FlagMap | null {
  if (!cache) return null;
  if (Date.now() - cache.fetchedAt > CACHE_TTL_MS) return null;
  return cache.flags;
}

export function useFeatureFlag(slug: string): { enabled: boolean; loading: boolean } {
  const cached = getCached();
  const [flags, setFlags] = useState<FlagMap | null>(cached);

  useEffect(() => {
    let cancelled = false;
    if (!getCached()) {
      fetchFlags().then((f) => {
        if (!cancelled) setFlags(f);
      });
    }
    const listener = (next: FlagMap) => {
      if (!cancelled) setFlags(next);
    };
    listeners.add(listener);
    return () => {
      cancelled = true;
      listeners.delete(listener);
    };
  }, []);

  return {
    enabled: Boolean(flags?.[slug]),
    loading: flags === null,
  };
}

/**
 * Force-refresh the cache. Useful after an admin toggle to surface the new
 * state without waiting for the 60s TTL.
 */
export async function refreshFeatureFlags(): Promise<FlagMap> {
  cache = null;
  inflight = null;
  return fetchFlags();
}
