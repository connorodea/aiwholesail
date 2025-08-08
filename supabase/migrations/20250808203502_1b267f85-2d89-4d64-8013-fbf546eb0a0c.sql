-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a cron job to run automated property alerts every 4 hours
SELECT cron.schedule(
  'automated-property-alerts',
  '0 */4 * * *', -- Every 4 hours
  $$
  SELECT
    net.http_post(
        url:='https://ztgsevhzbeywytoqlsbf.supabase.co/functions/v1/automated-property-alerts',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Z3Nldmh6YmV5d3l0b3Fsc2JmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzNDk2NTUsImV4cCI6MjA2OTkyNTY1NX0.YZLP7_Tpbk9BwScdN1zV6VBPfa19voOSgR76cn3ll9w"}'::jsonb,
        body:=concat('{"scheduled": true, "time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);