import React, { createContext, useContext, useEffect, useState } from 'react';
import apiClient, { auth, onAuthStateChange, User, stripe } from '@/lib/api-client';
import { validatePassword, validateEmail, logSecurityEvent } from '@/lib/security';
import { logSecurityEventEnhanced } from '@/lib/security-enhanced';

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
      const response = await auth.signUp(email.trim().toLowerCase(), password, fullName?.trim(), phoneNumber?.trim());

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
