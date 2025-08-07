-- Fix the subscribers table structure and add test accounts
-- First, make email nullable temporarily for test accounts
ALTER TABLE public.subscribers ALTER COLUMN email DROP NOT NULL;

-- Add unique constraint to user_id if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'subscribers_user_id_unique'
    ) THEN
        ALTER TABLE public.subscribers 
        ADD CONSTRAINT subscribers_user_id_unique UNIQUE (user_id);
    END IF;
END $$;

-- Now safely insert test accounts with email
INSERT INTO public.subscribers (user_id, email, subscribed, subscription_tier, subscription_end, stripe_customer_id)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'admin@test.com', true, 'admin', '2030-12-31T23:59:59Z', 'test_admin'),
  ('00000000-0000-0000-0000-000000000002', 'user@test.com', true, 'pro', '2030-12-31T23:59:59Z', 'test_user')
ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  subscribed = EXCLUDED.subscribed,
  subscription_tier = EXCLUDED.subscription_tier,
  subscription_end = EXCLUDED.subscription_end,
  stripe_customer_id = EXCLUDED.stripe_customer_id;

-- Update check-subscription function to handle test accounts
CREATE OR REPLACE FUNCTION public.handle_test_accounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Handle test admin account
  IF NEW.email = 'admin@test.com' THEN
    INSERT INTO public.subscribers (user_id, email, subscribed, subscription_tier, subscription_end, stripe_customer_id)
    VALUES (NEW.id, NEW.email, true, 'admin', '2030-12-31T23:59:59Z', 'test_admin')
    ON CONFLICT (user_id) DO UPDATE SET
      email = NEW.email,
      subscribed = true,
      subscription_tier = 'admin',
      subscription_end = '2030-12-31T23:59:59Z';
  END IF;

  -- Handle test user account  
  IF NEW.email = 'user@test.com' THEN
    INSERT INTO public.subscribers (user_id, email, subscribed, subscription_tier, subscription_end, stripe_customer_id)
    VALUES (NEW.id, NEW.email, true, 'pro', '2030-12-31T23:59:59Z', 'test_user')
    ON CONFLICT (user_id) DO UPDATE SET
      email = NEW.email,
      subscribed = true,
      subscription_tier = 'pro', 
      subscription_end = '2030-12-31T23:59:59Z';
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for test accounts
DROP TRIGGER IF EXISTS on_test_user_created ON auth.users;
CREATE TRIGGER on_test_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW 
  WHEN (NEW.email IN ('admin@test.com', 'user@test.com'))
  EXECUTE FUNCTION public.handle_test_accounts();