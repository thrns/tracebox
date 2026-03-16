import type { BotStateType } from '../state'
import { generateSpeech } from '@/lib/elevenlabs/tts'
import { injectAudio } from '@/lib/stagehand/audio-injector'
import type { BotBrowser } from '@/lib/stagehand/browser-manager'
import { broadcastTranscript } from '@/lib/supabase/broadcast'
import { botLog } from '@/lib/logging/bot-logger'

const log = (botId: string, msg: string, data?: unknown) =>
  botLog(botId, 'speak', data !== undefined ? msg + ' ' + String(data) : msg)

export async function speakNode(state: BotStateType): Promise<Partial<BotStateType>> {
  const browser = state.browserHandle as BotBrowser
  if (!browser || !state.nextBotUtterance || !state.isSessionActive) {
    log(state.botId, 'Skipping — no browser, no utterance, or session inactive')
    return {}
  }

  const utterance = state.nextBotUtterance.trim()
  if (!utterance) {
    log(state.botId, 'Skipping TTS — empty utterance')
    return {}
  }

  log(state.botId, `Speaking: "${utterance}"`)

  try {
    const audioBuffer = await generateSpeech(utterance)
    log(state.botId, `TTS generated: ${audioBuffer.length} bytes`)

    await injectAudio(browser.page, audioBuffer)
    log(state.botId, 'Audio injected into browser mic')

    const timestampMs = Date.now() - state.sessionStartTime

    const updatedHistory = [
      ...state.conversationHistory,
      { speaker: 'bot' as const, text: utterance, timestampMs },
    ]

    broadcastTranscript(state.botId, { speaker: 'bot', text: utterance, timestampMs })

    return {
      conversationHistory: updatedHistory,
      turnCount: state.turnCount + 1,
      currentStep: 'listen',
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Speak failed'
    log(state.botId, `ERROR: ${errorMessage}`, error)
    return {
      errorMessage,
      isSessionActive: false,
    }
  }
}
