import type { BotStateType } from '../state'
import { transcribeAudio } from '@/lib/deepgram/stt'
import { createAdminClient } from '@/lib/supabase/admin'

export async function transcribeNode(state: BotStateType): Promise<Partial<BotStateType>> {
  const audio = Buffer.concat(state.audioChunks ?? [])
  await createAdminClient()
    .from('bots')
    .update({ status: 'transcribing', updated_at: new Date().toISOString() })
    .eq('id', state.botId)

  if (audio.length === 0) {
    return { lastSystemUtterance: '', currentStep: 'finish' }
  }

  try {
    const text = await transcribeAudio(audio)
    const timestampMs = Date.now() - state.sessionStartTime
    return {
      lastSystemUtterance: text,
      conversationHistory: text
        ? [...state.conversationHistory, { speaker: 'system', text, timestampMs }]
        : state.conversationHistory,
      currentStep: 'finish',
    }
  } catch (error) {
    return {
      lastSystemUtterance: '',
      errorMessage: error instanceof Error ? error.message : 'Transcription failed',
      currentStep: 'finish',
    }
  }
}
