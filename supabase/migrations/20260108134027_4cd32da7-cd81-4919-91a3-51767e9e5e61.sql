-- Add validation_status column to scores table to track AI validation results
-- Values: 'ai_validated' (both match), 'score_only' (score matches, machine not), 'not_validated' (neither match), null (not checked)
ALTER TABLE public.scores 
ADD COLUMN validation_status text;

-- Add comment for clarity
COMMENT ON COLUMN public.scores.validation_status IS 'AI validation status: ai_validated, score_only, not_validated, or null if not checked';