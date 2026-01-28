-- Move instructions from storage bucket to a DB column on workspaces.
-- This removes the storage RLS dependency and allows in-place edits.

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS instructions TEXT NOT NULL DEFAULT '';

ALTER TABLE workspaces
  DROP COLUMN IF EXISTS instructions_file_path;
