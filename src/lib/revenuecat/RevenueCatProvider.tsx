import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Purchases, type CustomerInfo } from '@revenuecat/purchases-capacitor';

import { useAuth } from '@/contexts/AuthContext';

import {
  ensureConfigured,
  fetchCustomerInfo,
  hasProEntitlement,
  identifyUser,
  resetUser,
  restorePurchases as restoreCalls,
  setUserAttributes,
} from './client';
import { isNative } from './config';
import {
  presentCustomerCenter as presentCustomerCenterCall,
  presentPaywall as presentPaywallCall,
  presentPaywallIfNeeded as presentPaywallIfNeededCall,
  type PaywallOutcome,
} from './paywall';

interface RevenueCatContextValue {
  ready: boolean;
  available: boolean;
  customerInfo: CustomerInfo | null;
  isPro: boolean;
  refresh: () => Promise<void>;
  restore: () => Promise<PaywallOutcome>;
  presentPaywall: () => Promise<PaywallOutcome>;
  presentPaywallIfNeeded: () => Promise<PaywallOutcome>;
  presentCustomerCenter: () => Promise<void>;
}

const noopAsync = async () => 'unavailable' as PaywallOutcome;

const defaultValue: RevenueCatContextValue = {
  ready: false,
  available: false,
  customerInfo: null,
  isPro: false,
  refresh: async () => {},
  restore: noopAsync,
  presentPaywall: noopAsync,
  presentPaywallIfNeeded: noopAsync,
  presentCustomerCenter: async () => {},
};

const RevenueCatContext = createContext<RevenueCatContextValue>(defaultValue);

export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [ready, setReady] = useState(false);
  const [available] = useState<boolean>(() => isNative());
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const listenerHandleRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    if (!available) {
      setReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const ok = await ensureConfigured();
      if (cancelled) return;
      if (!ok) {
        setReady(true);
        return;
      }
      try {
        const handle = await Purchases.addCustomerInfoUpdateListener(
          (info) => setCustomerInfo(info as CustomerInfo),
        );
        listenerHandleRef.current = handle as { remove: () => void };
      } catch (err) {
        console.warn('[RevenueCat] failed to attach listener', err);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
      try {
        listenerHandleRef.current?.remove?.();
      } catch {
        /* noop */
      }
      listenerHandleRef.current = null;
    };
  }, [available]);

  // Sync RC identity with app auth. RC `appUserID` = our internal user id so
  // subscriptions follow the user across devices and reinstalls.
  useEffect(() => {
    if (!available || !ready) return;
    let cancelled = false;
    (async () => {
      try {
        if (user?.id) {
          const info = await identifyUser(user.id);
          if (cancelled) return;
          if (info) setCustomerInfo(info);
          if (user.email) {
            await setUserAttributes({ $email: user.email });
          }
        } else {
          await resetUser();
          if (!cancelled) setCustomerInfo(null);
        }
      } catch (err) {
        console.warn('[RevenueCat] identity sync failed', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [available, ready, user?.id, user?.email]);

  const refresh = useCallback(async () => {
    if (!available) return;
    try {
      const info = await fetchCustomerInfo();
      if (info) setCustomerInfo(info);
    } catch (err) {
      console.warn('[RevenueCat] refresh failed', err);
    }
  }, [available]);

  const restore = useCallback(async (): Promise<PaywallOutcome> => {
    if (!available) return 'unavailable';
    try {
      const info = await restoreCalls();
      if (info) setCustomerInfo(info);
      return hasProEntitlement(info) ? 'restored' : 'cancelled';
    } catch (err) {
      console.warn('[RevenueCat] restore failed', err);
      return 'error';
    }
  }, [available]);

  const presentPaywall = useCallback(async () => {
    const outcome = await presentPaywallCall();
    if (outcome === 'purchased' || outcome === 'restored') {
      await refresh();
    }
    return outcome;
  }, [refresh]);

  const presentPaywallIfNeeded = useCallback(async () => {
    const outcome = await presentPaywallIfNeededCall();
    if (outcome === 'purchased' || outcome === 'restored') {
      await refresh();
    }
    return outcome;
  }, [refresh]);

  const presentCustomerCenter = useCallback(async () => {
    await presentCustomerCenterCall();
    await refresh();
  }, [refresh]);

  const value = useMemo<RevenueCatContextValue>(
    () => ({
      ready,
      available,
      customerInfo,
      isPro: hasProEntitlement(customerInfo),
      refresh,
      restore,
      presentPaywall,
      presentPaywallIfNeeded,
      presentCustomerCenter,
    }),
    [
      ready,
      available,
      customerInfo,
      refresh,
      restore,
      presentPaywall,
      presentPaywallIfNeeded,
      presentCustomerCenter,
    ],
  );

  return (
    <RevenueCatContext.Provider value={value}>{children}</RevenueCatContext.Provider>
  );
}

export function useRevenueCat(): RevenueCatContextValue {
  return useContext(RevenueCatContext);
}
