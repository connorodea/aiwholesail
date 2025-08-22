import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Shield, AlertTriangle, Clock } from 'lucide-react';
import { useSecurity } from '@/components/SecurityProvider';
import { useAuth } from '@/contexts/AuthContext';

export function SessionTimeoutWarning() {
  const { sessionActive, lastActivity, securityLevel } = useSecurity();
  const { signOut } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    // Don't start timeout checking immediately after login
    // Wait for user to be actually active first
    if (!sessionActive || lastActivity === 0) {
      return;
    }

    const checkSessionTimeout = () => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivity;
      const warningThreshold = 25 * 60 * 1000; // 25 minutes (5 min before timeout)
      const timeoutThreshold = 30 * 60 * 1000; // 30 minutes

      // Only check timeout if session has been active for at least 1 minute
      // This prevents immediate logout after login
      if (timeSinceActivity < 60 * 1000) {
        setShowWarning(false);
        return;
      }

      if (timeSinceActivity >= warningThreshold && timeSinceActivity < timeoutThreshold) {
        setShowWarning(true);
        setTimeLeft(Math.ceil((timeoutThreshold - timeSinceActivity) / 1000));
      } else if (timeSinceActivity >= timeoutThreshold) {
        setShowWarning(false);
        console.log('[SESSION] Auto-logout due to inactivity:', { timeSinceActivity, lastActivity });
        signOut();
      } else {
        setShowWarning(false);
      }
    };

    const interval = setInterval(checkSessionTimeout, 5000); // Check every 5 seconds instead of every second
    return () => clearInterval(interval);
  }, [lastActivity, signOut, sessionActive]);

  const handleExtendSession = () => {
    // Activity will be tracked automatically by SecurityProvider
    setShowWarning(false);
    // Trigger a small user action to reset activity timer
    document.body.click();
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (!showWarning || !sessionActive) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md">
      <Alert className="border-warning bg-warning/10">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="font-semibold">Session expires in {formatTime(timeLeft)}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Your session will expire due to inactivity. Click below to continue working.
          </p>
          <div className="flex gap-2">
            <Button 
              onClick={handleExtendSession}
              variant="outline" 
              size="sm"
              className="flex-1"
            >
              <Shield className="h-3 w-3 mr-1" />
              Continue Session
            </Button>
            <Button 
              onClick={signOut}
              variant="ghost" 
              size="sm"
            >
              Sign Out
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}

export function SecurityStatus() {
  const { securityLevel } = useSecurity();
  
  if (securityLevel === 'low') return null;

  const getSecurityIcon = () => {
    switch (securityLevel) {
      case 'high':
        return <AlertTriangle className="h-3 w-3 text-warning" />;
      case 'medium':
        return <Shield className="h-3 w-3 text-primary" />;
      default:
        return null;
    }
  };

  const getSecurityMessage = () => {
    switch (securityLevel) {
      case 'high':
        return 'High security mode active';
      case 'medium':
        return 'Secure session active';
      default:
        return '';
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-40">
      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 text-xs">
        {getSecurityIcon()}
        <span className="text-muted-foreground">{getSecurityMessage()}</span>
      </div>
    </div>
  );
}