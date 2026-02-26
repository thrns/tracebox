-- Add run_number to bots so each workspace run is preserved as a separate group.
-- Existing bots default to run 1. The UNIQUE constraint is updated to include run_number.
ALTER TABLE bots ADD COLUMN IF NOT EXISTS run_number INTEGER NOT NULL DEFAULT 1;

-- Drop old unique constraint and create a new one that includes run_number
ALTER TABLE bots DROP CONSTRAINT IF EXISTS bots_workspace_id_bot_number_key;
ALTER TABLE bots ADD CONSTRAINT bots_workspace_id_run_number_bot_number_key UNIQUE (workspace_id, run_number, bot_number);

CREATE INDEX IF NOT EXISTS idx_bots_run_number ON bots(workspace_id, run_number);
