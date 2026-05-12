/**
 * Subscription tier resolution — pure helpers, frontend side.
 *
 * Mirror of `aiwholesail-api/lib/subscriptionTier.js` so the backend and
 * frontend never disagree on what `'elite'` / `'Premium'` / `'pro'` mean.
 *
 * Extracted from `src/hooks/useSubscription.ts` and `src/pages/Account.tsx`
 * so unit tests can exercise the logic without a React tree, a fetch mock,
 * or a localStorage mock.
 */

export type SubscriptionTier = 'Pro' | 'Elite' | 'none';

/**
 * Normalize a raw `subscription_tier` value into the canonical capitalized
 * form. Accepts any case, trims whitespace, treats legacy 'Premium' as Elite.
 *
 * Bug guarded:
 *   #4 — Case-sensitive strict comparison silently demoted users whose row
 *        had been written as 'elite' / 'ELITE' / 'Premium ' (etc.) to 'none'.
 */
export function normalizeTier(raw: unknown): SubscriptionTier {
  if (typeof raw !== 'string') return 'none';
  const t = raw.trim().toLowerCase();
  if (t === 'elite' || t === 'premium') return 'Elite';
  if (t === 'pro') return 'Pro';
  return 'none';
}

// ---------------------------------------------------------------------------
// Cache helpers (keyed by user, with TTL)
// ---------------------------------------------------------------------------
//
// Storage shape and behavior are part of the test contract — these helpers are
// what the React hook ultimately wraps. Tests can exercise them with a stubbed
// localStorage (see tests/setup.ts for the jsdom-default).

const CACHE_KEY = 'aiwholesail_subscription_cache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedSubscription {
  tier: SubscriptionTier;
  /** Owner of this cache entry — must match the current user before we trust it. */
  userId: string | null;
  timestamp: number;
}

/** Per-storage handle so tests can pass a fake storage without touching the
 *  global `localStorage`. Production code defaults to `localStorage`. */
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): StorageLike | null {
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

/**
 * Read the cached tier IFF the entry was written by the current user AND has
 * not exceeded the TTL. Mismatched user or expired entry → null (miss).
 *
 * Bug guarded:
 *   #1 — Global cache leaked between users on the same device.
 */
export function getCachedTier(
  currentUserId: string | null | undefined,
  storage: StorageLike | null = defaultStorage(),
): SubscriptionTier | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedSubscription = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
      storage.removeItem(CACHE_KEY);
      return null;
    }
    if ((cached.userId ?? null) !== (currentUserId ?? null)) {
      return null;
    }
    return cached.tier;
  } catch {
    return null;
  }
}

/** Persist a tier for `userId`. Overwrites any prior entry. */
export function setCachedTier(
  tier: SubscriptionTier,
  userId: string | null | undefined,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    const entry: CachedSubscription = {
      tier,
      userId: userId ?? null,
      timestamp: Date.now(),
    };
    storage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // ignore quota/storage errors
  }
}

/**
 * Drop the cache entirely. Called on signOut so the next user signing in on
 * this device starts from a clean read.
 *
 * Bug guarded:
 *   #3 — signOut left subscription cache behind.
 */
export function clearCachedTier(
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}

/** Constants exposed for tests that want to assert on TTL/storage-key. */
export const __testInternals = { CACHE_KEY, CACHE_TTL_MS };
