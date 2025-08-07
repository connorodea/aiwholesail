-- Security Enhancement: Fix nullable user_id in subscribers table
-- This ensures data integrity and proper RLS enforcement

-- First, clean up any orphaned records with null user_id
DELETE FROM public.subscribers WHERE user_id IS NULL;

-- Make user_id NOT NULL to prevent future orphaned records
ALTER TABLE public.subscribers ALTER COLUMN user_id SET NOT NULL;

-- Add foreign key constraint to ensure referential integrity with auth.users
-- This will prevent orphaned subscriber records
ALTER TABLE public.subscribers 
ADD CONSTRAINT fk_subscribers_user_id 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;