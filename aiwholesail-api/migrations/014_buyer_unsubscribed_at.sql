-- Unsubscribe gate for buyer outreach (TCPA / CAN-SPAM compliance).
--
-- `buyers` rows represent third-party buyer-leads that the operator
-- contacts via SMS/email through POST /api/buyers/:id/outreach. If a
-- buyer asks to stop receiving messages, we set unsubscribed_at and the
-- outreach handler refuses to send. The public /api/unsubscribe/:token
-- endpoint sets this column from a one-click email link.
--
-- Scope note: only `buyers` is gated in this migration. Generic
-- /api/communications/email|sms (operator types an address with no DB
-- row backing) and the not-yet-built sequences worker each need a
-- different model — likely a separate `outreach_suppressions(user_id,
-- recipient_address)` table — which will land in a follow-up PR once
-- those code paths are wired.

ALTER TABLE buyers
  ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN buyers.unsubscribed_at IS
  'Set when the buyer opts out via /api/unsubscribe/:token. POST /api/buyers/:id/outreach refuses to send when NOT NULL.';

-- The hot path is the existing outreach SELECT (already filters by id +
-- user_id). Adding unsubscribed_at to the WHERE clause doesn't need a
-- new index — the existing PK lookup is exact.
