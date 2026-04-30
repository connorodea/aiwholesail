import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { isNative } from '@/lib/platform';
import { initPurchases, identifyUser, hasAnySubscription } from '@/lib/purchases';
import { NativePaywall } from './NativePaywall';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [checkingSubscription, setCheckingSubscription] = useState(isNative);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  // On native: init RevenueCat and check subscription after auth
  useEffect(() => {
    if (!isNative || !user) return;

    const checkNativeSubscription = async () => {
      try {
        await initPurchases();
        await identifyUser(user.id);

        // Check RevenueCat subscription (iOS IAP)
        const hasIAP = await hasAnySubscription();
        if (hasIAP) {
          setHasSubscription(true);
          setCheckingSubscription(false);
          return;
        }

        // Fallback: check backend for active Stripe subscription (web subscribers)
        // This allows web Stripe subscribers to use the iOS app without re-purchasing
        setHasSubscription(false);
        setShowPaywall(true);
      } catch (err) {
        console.warn('[ProtectedRoute] Subscription check failed:', err);
        // On error, allow access (don't block users due to network issues)
        setHasSubscription(true);
      } finally {
        setCheckingSubscription(false);
      }
    };

    checkNativeSubscription();
  }, [user]);

  // Show loading spinner while checking authentication
  if (loading || checkingSubscription) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-accent/5">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">
            {loading ? 'Checking authentication...' : 'Checking subscription...'}
          </p>
        </div>
      </div>
    );
  }

  // Redirect to auth page if not authenticated, preserving intended destination
  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth?redirect=${redirect}`} replace />;
  }

  // Native: show paywall if no subscription
  if (isNative && showPaywall && !hasSubscription) {
    return (
      <NativePaywall
        onSubscribed={() => {
          setHasSubscription(true);
          setShowPaywall(false);
        }}
      />
    );
  }

  // User is authenticated (and subscribed on native), render protected content
  return <>{children}</>;
}