import { useState, useEffect, useCallback } from 'react';
import { stripe as stripeApi } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';

export type SubscriptionTier = 'Pro' | 'Elite' | 'none';

interface SubscriptionState {
  tier: SubscriptionTier;
  isElite: boolean;
  isPro: boolean;
  isTrial: boolean;
  isSubscribed: boolean;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const CACHE_KEY = 'aiwholesail_subscription_cache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedSubscription {
  tier: SubscriptionTier;
  /** Owner of this cache entry — must match the current user before we trust it.
   *  Prevents a stale tier from user A leaking to user B on the same device. */
  userId: string | null;
  timestamp: number;
}

function getCached(currentUserId: string | null | undefined): SubscriptionTier | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedSubscription = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    // Cache is keyed to the user that wrote it. If a different user (or signed-out
    // state) is asking, treat the cache as miss.
    if ((cached.userId ?? null) !== (currentUserId ?? null)) {
      return null;
    }
    return cached.tier;
  } catch {
    return null;
  }
}

function setCache(tier: SubscriptionTier, userId: string | null | undefined): void {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ tier, userId: userId ?? null, timestamp: Date.now() } satisfies CachedSubscription)
    );
  } catch {
    // Ignore storage errors
  }
}

/** Explicitly drop the cache. Called on sign-out so the next sign-in starts fresh. */
export function clearSubscriptionCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Ignore
  }
}

/** Tier strings can drift in case (`'elite'`, `'ELITE'`, `'Premium'`). Normalize
 *  defensively before comparing so a manual SQL fix or legacy import can't
 *  silently demote a paying customer. */
function normalizeTier(raw: unknown): SubscriptionTier {
  if (typeof raw !== 'string') return 'none';
  const t = raw.trim().toLowerCase();
  if (t === 'elite' || t === 'premium') return 'Elite';
  if (t === 'pro') return 'Pro';
  return 'none';
}

export function useSubscription(): SubscriptionState {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [tier, setTier] = useState<SubscriptionTier>(() => getCached(userId) || 'none');
  const [isTrial, setIsTrial] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await stripeApi.getSubscription();

      if (response.error) {
        // On error, don't change tier — keep cached/default
        setError(response.error);
        setLoading(false);
        return;
      }

      const data = response.data as any;

      if (!data || !data.subscribed) {
        setTier('none');
        setIsTrial(false);
        setCache('none', userId);
        setLoading(false);
        return;
      }

      // Determine tier — trial users keep their actual subscription tier
      // so that feature gating (isPro / isElite) works during the trial.
      const normalized = normalizeTier(data.subscription_tier);
      let resolvedTier: SubscriptionTier = 'none';
      let trialActive = false;

      if (data.is_trial) {
        // Check if trial is still active
        if (data.trial_end && new Date(data.trial_end) < new Date()) {
          resolvedTier = 'none';
        } else {
          trialActive = true;
          // Trial defaults to Pro if no explicit tier is set on the row.
          resolvedTier = normalized === 'none' ? 'Pro' : normalized;
        }
      } else {
        resolvedTier = normalized;
      }

      setTier(resolvedTier);
      setIsTrial(trialActive);
      setCache(resolvedTier, userId);
    } catch (err) {
      console.error('[useSubscription] Failed to fetch subscription:', err);
      setError('Failed to load subscription status');
      // Don't change tier on network error — keep cached value
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    // Re-fetch whenever the signed-in user changes (login, logout, account switch).
    // Without this the hook is sticky to the tier of whoever signed in first
    // after page load.
    if (!userId) {
      setTier('none');
      setIsTrial(false);
      setLoading(false);
      return;
    }
    // Seed from per-user cache before the network round-trip so the UI doesn't
    // flash "none" on every navigation.
    const cached = getCached(userId);
    if (cached) setTier(cached);
    fetchSubscription();
  }, [userId, fetchSubscription]);

  return {
    tier,
    isElite: tier === 'Elite',
    isPro: tier === 'Pro',
    isTrial,
    isSubscribed: tier !== 'none',
    loading,
    error,
    refetch: fetchSubscription,
  };
}
