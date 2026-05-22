-- 036 — RevenueCat (Apple/Google IAP) support on subscribers table.
--
-- Web subscriptions come from Stripe. iOS subscriptions are bought through
-- Apple IAP and tracked by RevenueCat, which posts entitlement events to
-- /api/iap/revenuecat/webhook. The two sources coexist for the same user
-- so we add a `source` discriminator and an RC linkage column.
--
-- Migration is additive — defaults preserve existing rows as Stripe.

ALTER TABLE subscribers
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS revenuecat_app_user_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS revenuecat_original_transaction_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS revenuecat_product_id VARCHAR(255);

-- Backfill: every existing row was Stripe-sourced.
UPDATE subscribers SET source = 'stripe' WHERE source IS NULL;

-- Fast lookup from RC webhook payload's app_user_id → subscribers row.
CREATE INDEX IF NOT EXISTS idx_subscribers_revenuecat_app_user_id
  ON subscribers (revenuecat_app_user_id)
  WHERE revenuecat_app_user_id IS NOT NULL;
