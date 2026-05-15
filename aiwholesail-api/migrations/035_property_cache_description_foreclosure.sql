-- Migration: add description + is_foreclosure columns to property_search_cache.
--
-- Why (follow-up to PR #437, 2026-05-15):
--
--   PR #437 wired isAuctionSubject() into the spread-alert email worker
--   so foreclosure auctions don't surface as "+$295,000 spread" deal
--   alerts. The cache schema (migration 005) carries only price + sqft,
--   so only the PPSF and low-absolute-price branches of the filter
--   fire. The two most reliable detection signals — Zillow's explicit
--   isForeclosure boolean and the description-keyword regex — are dark
--   for alerts.
--
--   This migration adds both columns. The worker upsert (companion
--   change to spread-alert-worker.js) populates them on every scrape;
--   the existing JS filter in the worker picks them up automatically.
--
-- Idempotency: ADD COLUMN IF NOT EXISTS — re-running this migration
-- on a partial-rollout DB is a no-op. Safe to apply via the standard
-- migrate runner.
--
-- No GRANT block needed — property_search_cache exists in the legacy
-- baseline (migration 005 didn't ship per-table GRANTs; prod tolerates
-- via role-level permissions). The migration-grant-guard's baseline
-- file (added in PR #427) covers it.
--
-- No data backfill required. NULL is the correct initial value for
-- both columns on legacy rows — the auction filter treats NULL as
-- "no signal," falling back to PPSF / low-price heuristics that
-- already worked.

ALTER TABLE property_search_cache
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE property_search_cache
  ADD COLUMN IF NOT EXISTS is_foreclosure BOOLEAN;
