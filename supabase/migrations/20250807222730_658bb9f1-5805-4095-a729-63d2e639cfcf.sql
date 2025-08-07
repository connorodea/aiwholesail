-- Add unique constraint to support upserts in ai-lead-scoring function
ALTER TABLE public.lead_scoring
ADD CONSTRAINT lead_scoring_lead_id_unique UNIQUE (lead_id);
