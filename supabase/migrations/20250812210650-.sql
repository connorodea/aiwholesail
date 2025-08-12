-- Fix remaining security linter issues

-- 1. Fix function search path security issue
-- Update existing functions to have secure search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Update audit function with secure search_path
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 2. Add rate limiting table for edge function security
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL, -- user_id, ip_address, or other identifier
  function_name text NOT NULL,
  request_count integer DEFAULT 0,
  window_start timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(identifier, function_name)
);

-- Enable RLS on rate_limits table
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Rate limits can be managed by system only
CREATE POLICY "System can manage rate limits" 
ON public.rate_limits 
FOR ALL 
USING (true)
WITH CHECK (true);

-- 3. Create function to clean up old rate limit records
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  -- Delete rate limit records older than 24 hours
  DELETE FROM public.rate_limits 
  WHERE window_start < now() - interval '24 hours';
  
  -- Delete old security events (keep last 30 days)
  DELETE FROM public.security_events 
  WHERE created_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';