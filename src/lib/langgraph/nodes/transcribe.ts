import type { BotStateType } from '../state'
import { transcribeAudio } from '@/lib/deepgram/stt'
import { createAdminClient } from '@/lib/supabase/admin'
import { broadcastTranscript } from '@/lib/supabase/broadcast'
import { botLog } from '@/lib/logging/bot-logger'

const log = (botId: string, msg: string, data?: unknown) =>
  botLog(botId, 'transcribe', data !== undefined ? msg + ' ' + String(data) : msg)

export async function transcribeNode(state: BotStateType): Promise<Partial<BotStateType>> {
  const supabase = createAdminClient()

  await supabase
    .from('bots')
    .update({ status: 'transcribing', updated_at: new Date().toISOString() })
    .eq('id', state.botId)

  // Whether the bot spoke last turn (used to track consecutive bot-speaks-no-response)
  const botSpokeLastTurn = !!state.nextBotUtterance?.trim()

  if (!state.audioChunks || state.audioChunks.length === 0) {
    log(state.botId, 'No audio chunks — system silent or WebRTC not active')
    return {
      lastSystemUtterance: '',
      consecutiveEmptyTurns: (state.consecutiveEmptyTurns ?? 0) + 1,
      consecutiveBotSpeaksNoResponse: botSpokeLastTurn
        ? (state.consecutiveBotSpeaksNoResponse ?? 0) + 1
        : state.consecutiveBotSpeaksNoResponse ?? 0,
      currentStep: 'reason',
    }
  }

  const audioBuffer = Buffer.concat(state.audioChunks)
  if (audioBuffer.length === 0) {
    log(state.botId, 'Skipping Deepgram — audio buffer is empty after concat')
    return {
      lastSystemUtterance: '',
      consecutiveEmptyTurns: (state.consecutiveEmptyTurns ?? 0) + 1,
      consecutiveBotSpeaksNoResponse: botSpokeLastTurn
        ? (state.consecutiveBotSpeaksNoResponse ?? 0) + 1
        : state.consecutiveBotSpeaksNoResponse ?? 0,
      currentStep: 'reason',
    }
  }
  log(state.botId, `Transcribing ${audioBuffer.length} bytes via Deepgram...`)

  try {
    const transcript = await transcribeAudio(audioBuffer)
    log(state.botId, `Transcript: "${transcript || '(empty)'}"`)

    const timestampMs = Date.now() - state.sessionStartTime

    const updatedHistory = [
      ...state.conversationHistory,
      ...(transcript
        ? [{ speaker: 'system' as const, text: transcript, timestampMs }]
        : []),
    ]

    if (transcript) {
      broadcastTranscript(state.botId, { speaker: 'system', text: transcript, timestampMs })
    }

    return {
      lastSystemUtterance: transcript,
      conversationHistory: updatedHistory,
      consecutiveEmptyTurns: transcript ? 0 : (state.consecutiveEmptyTurns ?? 0) + 1,
      // Reset if system responded; increment if bot spoke and system stayed silent
      consecutiveBotSpeaksNoResponse: transcript
        ? 0
        : botSpokeLastTurn
          ? (state.consecutiveBotSpeaksNoResponse ?? 0) + 1
          : state.consecutiveBotSpeaksNoResponse ?? 0,
      currentStep: 'reason',
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Transcription failed'
    log(state.botId, `ERROR: ${errorMessage}`, error)
    return {
      lastSystemUtterance: '',
      errorMessage,
      currentStep: 'reason',
    }
  }
}
