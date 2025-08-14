-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests if not already enabled  
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a cron job to run automated property alerts every hour
SELECT cron.schedule(
  'automated-property-alerts-hourly',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
        url:='https://ztgsevhzbeywytoqlsbf.supabase.co/functions/v1/automated-property-alerts',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Z3Nldmh6YmV5d3l0b3Fsc2JmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzNDk2NTUsImV4cCI6MjA2OTkyNTY1NX0.YZLP7_Tpbk9BwScdN1zV6VBPfa19voOSgR76cn3ll9w"}'::jsonb,
        body:='{"automated": true}'::jsonb
    ) as request_id;
  $$
);

-- Check current cron jobs (for verification)
SELECT * FROM cron.job WHERE jobname = 'automated-property-alerts-hourly';