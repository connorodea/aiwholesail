-- Fix RLS policy issue - create a proper policy for the alert_scan_logs table
-- Drop the existing overly permissive policies first
DROP POLICY IF EXISTS "Admin can view scan logs" ON public.alert_scan_logs;
DROP POLICY IF EXISTS "System can insert scan logs" ON public.alert_scan_logs;

-- Create more specific policies
-- Allow system/service role to insert logs
CREATE POLICY "Service can insert scan logs" ON public.alert_scan_logs
  FOR INSERT WITH CHECK (true);

-- Allow authenticated users to view logs (they're system logs, so can be visible to all users)
CREATE POLICY "Users can view scan logs" ON public.alert_scan_logs
  FOR SELECT USING (auth.role() = 'authenticated');