export interface TranscriptEntry {
  id: string
  bot_id: string
  speaker: 'bot' | 'system'
  text: string
  timestamp_ms: number
  audio_file_path: string | null
  created_at: string
}
