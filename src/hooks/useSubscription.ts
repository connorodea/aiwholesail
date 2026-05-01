import { useState, useEffect, useCallback } from 'react';
import { stripe as stripeApi } from '@/lib/api-client';

export type SubscriptionTier = 'Pro' | 'Elite' | 'trial' | 'none';

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
  timestamp: number;
}

function getCached(): SubscriptionTier | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedSubscription = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return cached.tier;
  } catch {
    return null;
  }
}

function setCache(tier: SubscriptionTier): void {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ tier, timestamp: Date.now() } satisfies CachedSubscription)
    );
  } catch {
    // Ignore storage errors
  }
}

export function useSubscription(): SubscriptionState {
  const [tier, setTier] = useState<SubscriptionTier>(() => getCached() || 'none');
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
        setCache('none');
        setLoading(false);
        return;
      }

      // Determine tier — trial users keep their actual subscription tier
      // so that feature gating (isPro / isElite) works during the trial.
      let resolvedTier: SubscriptionTier = 'none';
      let trialActive = false;

      if (data.is_trial) {
        // Check if trial is still active
        if (data.trial_end && new Date(data.trial_end) < new Date()) {
          resolvedTier = 'none';
        } else {
          trialActive = true;
          if (data.subscription_tier === 'Elite' || data.subscription_tier === 'Premium') {
            resolvedTier = 'Elite';
          } else {
            // Default trial tier is Pro
            resolvedTier = 'Pro';
          }
        }
      } else if (data.subscription_tier === 'Elite' || data.subscription_tier === 'Premium') {
        resolvedTier = 'Elite';
      } else if (data.subscription_tier === 'Pro') {
        resolvedTier = 'Pro';
      }

      setTier(resolvedTier);
      setIsTrial(trialActive);
      setCache(resolvedTier);
    } catch (err) {
      console.error('[useSubscription] Failed to fetch subscription:', err);
      setError('Failed to load subscription status');
      // Don't change tier on network error — keep cached value
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

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
