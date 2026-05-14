-- Add read_at + composite index for the inbox unread/sort view.
--
-- The inbox UI sorts by received_at DESC and filters on read_at IS NULL
-- ("unread" tab). The composite index (user_id, read_at, received_at DESC)
-- covers both axes without an extra sort.

ALTER TABLE email_inbound_replies
    ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_email_inbound_replies_user_read
    ON email_inbound_replies(user_id, read_at, received_at DESC);
