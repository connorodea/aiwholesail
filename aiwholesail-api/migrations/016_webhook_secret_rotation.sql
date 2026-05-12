-- Webhook secret rotation with 24h dual-signature window.
--
-- POST /api/webhooks/:id/rotate generates a new HMAC secret and stores
-- the previous one alongside it. The delivery path then signs every
-- outgoing webhook payload with BOTH secrets for `WEBHOOK_ROTATION_GRACE_MS`
-- (24h) after rotation, sending two headers:
--
--   X-AIWholesail-Signature           — new secret
--   X-AIWholesail-Signature-Previous  — old secret (only during grace)
--
-- Subscribers can verify against either, giving them a window to
-- re-deploy without dropping any events.
--
-- Both columns are nullable: a webhook that has never been rotated has
-- previous_secret IS NULL and secret_rotated_at IS NULL, and the delivery
-- path just sends the single signature header (current behavior).

ALTER TABLE webhook_endpoints
  ADD COLUMN IF NOT EXISTS previous_secret   VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS secret_rotated_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN webhook_endpoints.previous_secret IS
  'Set by POST /:id/rotate. Used for dual-signing during the grace window; cleared after WEBHOOK_ROTATION_GRACE_MS expires.';
COMMENT ON COLUMN webhook_endpoints.secret_rotated_at IS
  'When the current secret was rotated in. NULL = never rotated.';
