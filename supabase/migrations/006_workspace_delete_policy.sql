-- Allow users to delete their own workspaces (bots cascade via FK)
CREATE POLICY "Users can delete own workspaces"
    ON workspaces FOR DELETE
    USING (auth.uid() = user_id);
