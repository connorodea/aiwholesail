import React, { createContext, useContext, useEffect, useState } from 'react';
import { logSecurityEventEnhanced, checkSessionTimeout } from '@/lib/security-enhanced';
import { useAuth } from '@/contexts/AuthContext';

interface SecurityContextType {
  sessionActive: boolean;
  lastActivity: number;
  updateActivity: () => void;
  securityLevel: 'low' | 'medium' | 'high';
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export function SecurityProvider({ children }: { children: React.ReactNode }) {
  const { user, session } = useAuth();
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [sessionActive, setSessionActive] = useState(true);
  const [securityLevel, setSecurityLevel] = useState<'low' | 'medium' | 'high'>('medium');

  const updateActivity = () => {
    setLastActivity(Date.now());
    setSessionActive(true);
  };

  useEffect(() => {
    // Track user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const activityHandler = () => {
      updateActivity();
    };

    events.forEach(event => {
      document.addEventListener(event, activityHandler, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, activityHandler, true);
      });
    };
  }, []);

  useEffect(() => {
    // Check session timeout every minute
    const interval = setInterval(() => {
      if (user && checkSessionTimeout(lastActivity, 30)) {
        setSessionActive(false);
        logSecurityEventEnhanced('session_timeout', { userId: user.id });
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [user, lastActivity]);

  useEffect(() => {
    // Set security level based on user and session
    if (!user || !session) {
      setSecurityLevel('low');
    } else if (session.expires_at && new Date(session.expires_at) < new Date(Date.now() + 3600000)) {
      setSecurityLevel('high'); // Session expires within 1 hour
    } else {
      setSecurityLevel('medium');
    }
  }, [user, session]);

  useEffect(() => {
    // Log security events
    if (user) {
      logSecurityEventEnhanced('session_check', {
        sessionActive,
        securityLevel,
        lastActivity: new Date(lastActivity).toISOString()
      }, user.id);
    }
  }, [sessionActive, securityLevel, user]);

  const value = {
    sessionActive,
    lastActivity,
    updateActivity,
    securityLevel
  };

  return (
    <SecurityContext.Provider value={value}>
      {children}
    </SecurityContext.Provider>
  );
}

export function useSecurity() {
  const context = useContext(SecurityContext);
  if (context === undefined) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
}