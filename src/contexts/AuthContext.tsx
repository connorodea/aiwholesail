import React, { createContext, useContext, useEffect, useState } from 'react';
import apiClient, { auth, onAuthStateChange, User, stripe } from '@/lib/api-client';
import { validatePassword, validateEmail, logSecurityEvent } from '@/lib/security';
import { logSecurityEventEnhanced } from '@/lib/security-enhanced';
import { getAttribution } from '@/lib/marketing-attribution';

interface AuthContextType {
  user: User | null;
  session: { access_token: string } | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string, phoneNumber?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const unsubscribe = onAuthStateChange((currentUser) => {
      setUser(currentUser);
      setSession(currentUser ? auth.getSession() : null);
      setLoading(false);

      // Check subscription status when user logs in
      if (currentUser) {
        setTimeout(() => {
          stripe.getSubscription().catch(console.error);
        }, 0);
      }
    });

    return () => unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName?: string, phoneNumber?: string) => {
    // Enhanced input validation for security
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      logSecurityEvent('signup_failed', { reason: 'invalid_email', email: email.substring(0, 3) + '***' });
      return { error: { message: emailValidation.error } };
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      logSecurityEvent('signup_failed', { reason: 'weak_password', email: email.substring(0, 3) + '***' });
      return { error: { message: passwordValidation.errors[0] } };
    }

    try {
      // First-touch attribution captured on the very first landing; sent
      // with the signup so the backend can persist + propagate to Stripe.
      const attribution = getAttribution() || undefined;
      const response = await auth.signUp(
        email.trim().toLowerCase(),
        password,
        fullName?.trim(),
        phoneNumber?.trim(),
        attribution as Record<string, string | undefined> | undefined,
      );

      if (response.error) {
        logSecurityEvent('signup_failed', { reason: response.error, email: email.substring(0, 3) + '***' });
        return { error: { message: response.error } };
      }

      if (response.data) {
        logSecurityEventEnhanced('signup_success', { email: email.substring(0, 3) + '***' }, response.data.user.id);
      }

      return { error: null };
    } catch (error: any) {
      logSecurityEvent('signup_error', { error: error.message });
      return { error: { message: 'An unexpected error occurred during signup' } };
    }
  };

  const signIn = async (email: string, password: string) => {
    // Enhanced input validation for security
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      logSecurityEvent('signin_failed', { reason: 'invalid_email', email: email.substring(0, 3) + '***' });
      return { error: { message: emailValidation.error } };
    }

    if (!password) {
      logSecurityEvent('signin_failed', { reason: 'no_password', email: email.substring(0, 3) + '***' });
      return { error: { message: 'Password is required' } };
    }

    try {
      const response = await auth.signIn(email.trim().toLowerCase(), password);

      if (response.error) {
        logSecurityEvent('signin_failed', { reason: response.error, email: email.substring(0, 3) + '***' });
        return { error: { message: response.error } };
      }

      if (response.data) {
        logSecurityEventEnhanced('signin_success', { email: email.substring(0, 3) + '***' }, response.data.user.id);
      }

      return { error: null };
    } catch (error: any) {
      logSecurityEvent('signin_error', { error: error.message });
      return { error: { message: 'An unexpected error occurred during signin' } };
    }
  };

  const signOut = async () => {
    try {
      await auth.signOut();
      // Explicitly clear local state
      setUser(null);
      setSession(null);
      // Drop any per-user caches so a different account signing in on this
      // device starts from a clean read — otherwise the previous user's
      // subscription tier (Elite / Pro / none) can leak into the next session.
      try {
        const { clearSubscriptionCache } = await import('@/hooks/useSubscription');
        clearSubscriptionCache();
      } catch {
        // Hook module not present in this build — safe to skip.
      }
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
