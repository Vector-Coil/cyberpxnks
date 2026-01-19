-- Add textual gains/result summary to gig_history for display in UI
-- Add textual gains/result summary to gig_history for display in UI
-- Use `last_gains_data` if present in schema; add it if missing.
ALTER TABLE gig_history
  ADD COLUMN IF NOT EXISTS last_gains_data VARCHAR(255) NULL;
