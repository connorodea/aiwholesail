-- Migration: backfill missing GRANT on llm_token_ledger (created in 013).
--
-- Migration 013 created the table but omitted the GRANT block, so when the
-- migration runner runs as a role other than `aiwholesail` (which is the
-- normal setup here), the aiwholesail role cannot read or write the table.
-- The downstream impact is silent: middleware/llmBudget.js and lib/llm-usage.js
-- both touch this table on every LLM call, and a missing privilege surfaces
-- as a 500 from Postgres ("permission denied for table llm_token_ledger").
--
-- Surfaced by the E2E audit on 2026-05-13. Same root cause as the earlier
-- migration-GRANT incident captured in the standing playbook (PR #131).
--
-- This migration is idempotent — GRANT is safe to re-run, and if the role
-- already has these privileges (e.g. someone backfilled by hand) it's a
-- no-op. We don't touch 013 in place because it's been applied to prod and
-- editing won't re-run it.

GRANT SELECT, INSERT, UPDATE, DELETE ON llm_token_ledger TO aiwholesail;

-- llm_token_ledger uses BIGSERIAL on its id column, which creates an
-- implicit sequence. Without USAGE+SELECT on the sequence, INSERTs that
-- rely on the default will fail too. Backfill in case it's also missing.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.sequences
    WHERE sequence_schema = 'public'
      AND sequence_name   = 'llm_token_ledger_id_seq'
  ) THEN
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE llm_token_ledger_id_seq TO aiwholesail';
  END IF;
END$$;
