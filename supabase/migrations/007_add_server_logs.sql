-- Add server_logs JSONB column to bots table for storing per-bot server logs
ALTER TABLE bots ADD COLUMN IF NOT EXISTS server_logs JSONB;
