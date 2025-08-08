-- Add trial tracking columns to subscribers table
ALTER TABLE public.subscribers 
ADD COLUMN trial_start TIMESTAMPTZ,
ADD COLUMN trial_end TIMESTAMPTZ,
ADD COLUMN is_trial BOOLEAN DEFAULT false;