export type BotStatus =
  | 'queued'
  | 'connecting'
  | 'running'
  | 'transcribing'
  | 'uploading'
  | 'complete'
  | 'error'
  | 'stopped'

export interface Bot {
  id: string
  workspace_id: string
  bot_number: number
  run_number: number
  status: BotStatus
  error_message: string | null
  session_duration_seconds: number | null
  recording_file_path: string | null
  recording_url: string | null
  transcript_json: TranscriptEntry[] | null
  screenshot_urls: string[] | null
  langgraph_trace: Record<string, number> | null
  server_logs: ServerLogEntry[] | null
  created_at: string
  updated_at: string
  started_at: string | null
  completed_at: string | null
}

export interface TranscriptEntry {
  speaker: 'bot' | 'system'
  text: string
  timestampMs: number
}

export interface ServerLogEntry {
  timestamp: number
  node: string
  message: string
  level: 'info' | 'warn' | 'error'
}
