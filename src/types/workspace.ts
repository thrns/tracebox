export type WorkspaceStatus = 'draft' | 'running' | 'completed' | 'failed' | 'stopped'
export type LLMProvider = 'openai' | 'gemini'

export interface Workspace {
  id: string
  user_id: string
  name: string
  target_url: string
  bot_count: number
  max_session_duration: number
  llm_provider: LLMProvider
  instructions: string
  status: WorkspaceStatus
  created_at: string
  updated_at: string
  started_at: string | null
  completed_at: string | null
}

export interface WorkspaceWithStats extends Workspace {
  completedBots: number
  failedBots: number
  runningBots: number
}
