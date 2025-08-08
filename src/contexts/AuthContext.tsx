import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { validatePassword, validateEmail, logSecurityEvent } from '@/lib/security';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Check subscription status when user logs in
        if (session?.user) {
          setTimeout(() => {
            supabase.functions.invoke('check-subscription').catch(console.error);
          }, 0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      // Check subscription status for existing session
      if (session?.user) {
        setTimeout(() => {
          supabase.functions.invoke('check-subscription').catch(console.error);
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName?: string) => {
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
    
    const redirectUrl = `${window.location.origin}/app`;
    
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: fullName ? { full_name: fullName.trim() } : undefined
        }
      });
      
      if (!error) {
        logSecurityEvent('signup_success', { email: email.substring(0, 3) + '***' });
      } else {
        logSecurityEvent('signup_failed', { reason: error.message, email: email.substring(0, 3) + '***' });
      }
      
      return { error };
    } catch (error) {
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
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });
      
      if (!error) {
        logSecurityEvent('signin_success', { email: email.substring(0, 3) + '***' });
      } else {
        logSecurityEvent('signin_failed', { reason: error.message, email: email.substring(0, 3) + '***' });
      }
      
      return { error };
    } catch (error) {
      logSecurityEvent('signin_error', { error: error.message });
      return { error: { message: 'An unexpected error occurred during signin' } };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
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