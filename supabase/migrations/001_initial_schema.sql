-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Workspaces table
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_url TEXT NOT NULL,
    bot_count INTEGER NOT NULL CHECK (bot_count >= 1 AND bot_count <= 100),
    max_session_duration INTEGER NOT NULL DEFAULT 300,
    llm_provider TEXT NOT NULL DEFAULT 'openai' CHECK (llm_provider IN ('openai', 'gemini')),
    instructions_file_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'completed', 'failed', 'stopped')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Bots table
CREATE TABLE bots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    bot_number INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
        'queued', 'connecting', 'running', 'transcribing', 'uploading', 'complete', 'error'
    )),
    error_message TEXT,
    session_duration_seconds INTEGER,
    recording_file_path TEXT,
    recording_url TEXT,
    transcript_json JSONB,
    langgraph_trace JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    UNIQUE(workspace_id, bot_number)
);

-- Transcript entries
CREATE TABLE transcript_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    speaker TEXT NOT NULL CHECK (speaker IN ('bot', 'system')),
    text TEXT NOT NULL,
    timestamp_ms INTEGER NOT NULL,
    audio_file_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_workspaces_user_id ON workspaces(user_id);
CREATE INDEX idx_workspaces_status ON workspaces(status);
CREATE INDEX idx_bots_workspace_id ON bots(workspace_id);
CREATE INDEX idx_bots_status ON bots(status);
CREATE INDEX idx_transcript_entries_bot_id ON transcript_entries(bot_id);

-- Row Level Security
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workspaces"
    ON workspaces FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workspaces"
    ON workspaces FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workspaces"
    ON workspaces FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view bots in own workspaces"
    ON bots FOR SELECT
    USING (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage bots"
    ON bots FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Users can view transcripts in own bots"
    ON transcript_entries FOR SELECT
    USING (bot_id IN (
        SELECT b.id FROM bots b
        JOIN workspaces w ON b.workspace_id = w.id
        WHERE w.user_id = auth.uid()
    ));

CREATE POLICY "Service role can manage transcripts"
    ON transcript_entries FOR ALL
    USING (true)
    WITH CHECK (true);

-- Enable Realtime for bots table
ALTER PUBLICATION supabase_realtime ADD TABLE bots;
