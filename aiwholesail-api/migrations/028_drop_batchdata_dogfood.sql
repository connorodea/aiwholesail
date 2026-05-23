-- Migration: remove the cpodea5 dogfood override for batchdata_offmarket.
--
-- Why this exists
-- ---------------
-- Migration 027 (PR #367) shipped with a per-user override that set
-- batchdata_offmarket=TRUE for cpodea5@gmail.com — written before the
-- decision to land the BatchData integration as a parking branch (no
-- account funding, BATCHDATA_API_KEY not set on prod).
--
-- The intent for the parking branch is flag OFF for EVERYONE, including
-- staff. A followup commit on the original PR branch dropped the override
-- block, but the auto-merge fired on the prior HEAD — the squash didn't
-- include the followup. Net effect on prod: cpodea5's user-override row
-- got inserted with enabled=TRUE, which would route their off-market
-- searches to BatchData → 503 'BATCHDATA_API_KEY not configured' →
-- broken UX for that one account.
--
-- Fix: DELETE the dogfood override row. Global flag remains OFF, so all
-- users (including cpodea5) keep calling PropData (the existing
-- behavior). The flag + proxy + frontend client remain in main as the
-- parking-branch infrastructure — ready to flip if vendor pricing
-- changes or we point the proxy at a different off-market vendor.
--
-- Reversibility: if dogfood becomes desired again later, re-INSERT the
-- row with the same shape as migration 027 did originally.

DELETE FROM feature_flag_users
 WHERE slug = 'batchdata_offmarket'
   AND user_id = (SELECT id FROM users WHERE email = 'cpodea5@gmail.com');
