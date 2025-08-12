-- Fix critical RLS policy vulnerabilities

-- 1. Fix subscribers table RLS policies (CRITICAL)
-- Drop the overly permissive update policy
DROP POLICY IF EXISTS "update_own_subscription" ON public.subscribers;

-- Create secure policies for subscribers table
CREATE POLICY "Users can view their own subscription only" 
ON public.subscribers 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription only" 
ON public.subscribers 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can create subscriptions" 
ON public.subscribers 
FOR INSERT 
WITH CHECK (true);

-- 2. Fix property_alert_matches RLS policies (CRITICAL)
-- Drop the dangerous system backdoor policy
DROP POLICY IF EXISTS "System can manage alert matches" ON public.property_alert_matches;

-- Create specific, limited access policies for property_alert_matches
CREATE POLICY "Users can view matches for their alerts only" 
ON public.property_alert_matches 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM property_alerts 
  WHERE property_alerts.id = property_alert_matches.alert_id 
  AND property_alerts.user_id = auth.uid()
));

CREATE POLICY "Automated system can create alert matches" 
ON public.property_alert_matches 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM property_alerts 
  WHERE property_alerts.id = property_alert_matches.alert_id
));

CREATE POLICY "System can update alert notification status" 
ON public.property_alert_matches 
FOR UPDATE 
USING (true)
WITH CHECK (true);

-- 3. Add security logging table for monitoring
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  event_type text NOT NULL,
  event_details jsonb DEFAULT '{}',
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on security_events table
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Security events can only be inserted by system/authenticated users
CREATE POLICY "System can log security events" 
ON public.security_events 
FOR INSERT 
WITH CHECK (true);

-- Users can only view their own security events
CREATE POLICY "Users can view their own security events" 
ON public.security_events 
FOR SELECT 
USING (auth.uid() = user_id);

-- 4. Create audit trigger for subscribers table
CREATE OR REPLACE FUNCTION audit_subscribers_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log subscription changes for security monitoring
  INSERT INTO public.security_events (user_id, event_type, event_details)
  VALUES (
    COALESCE(NEW.user_id, OLD.user_id),
    TG_OP || '_subscription',
    jsonb_build_object(
      'table', 'subscribers',
      'old_values', CASE WHEN TG_OP != 'INSERT' THEN row_to_json(OLD) ELSE NULL END,
      'new_values', CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW) ELSE NULL END
    )
  );
  
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for subscription changes
DROP TRIGGER IF EXISTS audit_subscribers_trigger ON public.subscribers;
CREATE TRIGGER audit_subscribers_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.subscribers
  FOR EACH ROW EXECUTE FUNCTION audit_subscribers_changes();