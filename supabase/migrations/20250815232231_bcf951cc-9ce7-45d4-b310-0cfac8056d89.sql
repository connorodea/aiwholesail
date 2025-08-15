-- Enable pg_cron extension for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a cron job to run property alerts every hour
SELECT cron.schedule(
  'automated-property-alerts-hourly',
  '0 * * * *', -- Run at the start of every hour
  $$
  SELECT
    net.http_post(
        url:='https://ztgsevhzbeywytoqlsbf.supabase.co/functions/v1/automated-property-alerts',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Z3Nldmh6YmV5d3l0b3Fsc2JmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzNDk2NTUsImV4cCI6MjA2OTkyNTY1NX0.YZLP7_Tpbk9BwScdN1zV6VBPfa19voOSgR76cn3ll9w"}'::jsonb,
        body:='{"automated": true}'::jsonb
    ) as request_id;
  $$
);

-- Create a table to log cron job executions for monitoring
CREATE TABLE IF NOT EXISTS public.alert_scan_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_time timestamp with time zone DEFAULT now(),
  alerts_processed integer DEFAULT 0,
  emails_sent integer DEFAULT 0,
  success boolean DEFAULT false,
  error_message text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on the logs table
ALTER TABLE public.alert_scan_logs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow system to insert logs
CREATE POLICY "System can insert scan logs" ON public.alert_scan_logs
  FOR INSERT WITH CHECK (true);

-- Create policy for users to view logs (admin only for now)
CREATE POLICY "Admin can view scan logs" ON public.alert_scan_logs
  FOR SELECT USING (true);