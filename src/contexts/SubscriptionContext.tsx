import React, { createContext, useContext, useEffect, useState } from 'react';
import { stripe } from '@/lib/api-client';
import { useAuth } from './AuthContext';

interface SubscriptionData {
  subscribed: boolean;
  subscription_tier: string | null;
  subscription_end: string | null;
  is_trial: boolean;
  trial_start: string | null;
  trial_end: string | null;
}

interface SubscriptionContextType {
  subscription: SubscriptionData | null;
  loading: boolean;
  refreshSubscription: () => Promise<void>;
  isTrialActive: boolean;
  trialDaysRemaining: number | null;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSubscription = async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await stripe.getSubscription();

      if (response.error) {
        console.error('Error checking subscription:', response.error);
        return;
      }

      if (response.data) {
        setSubscription(response.data as any);
      }
    } catch (error) {
      console.error('Error refreshing subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSubscription();
  }, [user]);

  // Calculate if trial is active and days remaining
  const isTrialActive = subscription?.is_trial && subscription?.trial_end
    ? new Date(subscription.trial_end) > new Date()
    : false;

  const trialDaysRemaining = subscription?.trial_end
    ? Math.max(0, Math.ceil((new Date(subscription.trial_end).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  const value = {
    subscription,
    loading,
    refreshSubscription,
    isTrialActive,
    trialDaysRemaining
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
