-- Improve RLS policies for property_intelligence table
DROP POLICY IF EXISTS "Users can view their own property intelligence" ON public.property_intelligence;
DROP POLICY IF EXISTS "Users can create their own property intelligence" ON public.property_intelligence;
DROP POLICY IF EXISTS "Users can update their own property intelligence" ON public.property_intelligence;

-- Create stricter RLS policies for property_intelligence
CREATE POLICY "property_intelligence_select_policy" 
ON public.property_intelligence 
FOR SELECT 
USING (
  auth.uid() = user_id AND
  user_id IS NOT NULL
);

CREATE POLICY "property_intelligence_insert_policy" 
ON public.property_intelligence 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND
  user_id IS NOT NULL AND
  property_id IS NOT NULL
);

CREATE POLICY "property_intelligence_update_policy" 
ON public.property_intelligence 
FOR UPDATE 
USING (
  auth.uid() = user_id AND
  user_id IS NOT NULL
) 
WITH CHECK (
  auth.uid() = user_id AND
  user_id IS NOT NULL
);

-- Improve subscribers table RLS policies
DROP POLICY IF EXISTS "select_own_subscription" ON public.subscribers;
DROP POLICY IF EXISTS "update_own_subscription" ON public.subscribers;
DROP POLICY IF EXISTS "insert_subscription" ON public.subscribers;

-- Create more secure subscribers policies
CREATE POLICY "subscribers_select_policy" 
ON public.subscribers 
FOR SELECT 
USING (
  (user_id = auth.uid() AND user_id IS NOT NULL) OR 
  (email = auth.email() AND email IS NOT NULL)
);

CREATE POLICY "subscribers_insert_policy" 
ON public.subscribers 
FOR INSERT 
WITH CHECK (
  (user_id = auth.uid() OR user_id IS NULL) AND
  email IS NOT NULL
);

CREATE POLICY "subscribers_update_policy" 
ON public.subscribers 
FOR UPDATE 
USING (
  (user_id = auth.uid() AND user_id IS NOT NULL) OR
  (email = auth.email() AND email IS NOT NULL)
) 
WITH CHECK (
  email IS NOT NULL
);

-- Add security audit table for tracking security events
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL,
  event_details JSONB,
  client_ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on security_events
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for security_events (admin only)
CREATE POLICY "security_events_admin_only" 
ON public.security_events 
FOR ALL 
USING (false); -- No one can access directly

-- Create security function to log events
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type TEXT,
  p_event_details JSONB DEFAULT NULL,
  p_client_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO public.security_events (
    user_id,
    event_type,
    event_details,
    client_ip,
    user_agent
  ) VALUES (
    auth.uid(),
    p_event_type,
    p_event_details,
    p_client_ip,
    p_user_agent
  ) RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON public.security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON public.security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON public.security_events(created_at);

-- Add NOT NULL constraints where needed for security
ALTER TABLE public.property_intelligence 
ALTER COLUMN user_id SET NOT NULL;

-- Add trigger to update property_intelligence updated_at
CREATE TRIGGER update_property_intelligence_updated_at
  BEFORE UPDATE ON public.property_intelligence
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();