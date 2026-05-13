-- Migration 021: mark zillow_scrape_do + skip_trace_tps flags deprecated.
--
-- PR #321 (2026-05-13) makes scrape.do the unconditional primary for Zillow
-- proxy calls and TruePeopleSearch the unconditional primary for skip-trace
-- byaddress/bynameaddress. The two feature flags that used to gate the
-- cutover (zillow_scrape_do, skip_trace_tps) are no longer read by code.
--
-- We DON'T delete the flag rows because:
--   * They're idempotent / harmless. feature_flag_globals only has effect
--     when a piece of code calls isEnabled(slug). Both call sites are gone.
--   * Deletion would also remove the cpodea5 per-user override rows in
--     feature_flag_users, which serve as a useful historical breadcrumb
--     for the dogfood phase.
--
-- Instead we annotate the description so anyone reading the table later
-- knows the rows are vestigial. Idempotent — guarded by NOT LIKE %DEPRECATED%
-- so re-running the migration doesn't append the marker twice.

UPDATE feature_flag_globals
SET description = description || ' [DEPRECATED 2026-05-13: scrape.do is now unconditional primary per PR #321. Flag no longer read by code.]'
WHERE slug IN ('zillow_scrape_do', 'skip_trace_tps')
  AND description NOT LIKE '%DEPRECATED%';
