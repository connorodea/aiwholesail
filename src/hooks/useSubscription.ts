import { useState, useEffect, useCallback } from 'react';
import { stripe as stripeApi } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import {
  type SubscriptionTier,
  normalizeTier,
  getCachedTier,
  setCachedTier,
  clearCachedTier,
} from '@/lib/subscription-tier';

export type { SubscriptionTier };

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

/** Explicitly drop the subscription cache. Called by `AuthContext.signOut`
 *  so the next user signing in on this device starts from a clean read. */
export function clearSubscriptionCache(): void {
  clearCachedTier();
}

export function useSubscription(): SubscriptionState {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [tier, setTier] = useState<SubscriptionTier>(() => getCachedTier(userId) || 'none');
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

      const data = response.data as { subscribed?: boolean; subscription_tier?: string; is_trial?: boolean; trial_end?: string | null } | undefined;

      if (!data || !data.subscribed) {
        setTier('none');
        setIsTrial(false);
        setCachedTier('none', userId);
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
      setCachedTier(resolvedTier, userId);
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
    const cached = getCachedTier(userId);
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
