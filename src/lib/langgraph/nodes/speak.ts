import type { BotStateType } from '../state'
import { generateSpeech } from '@/lib/elevenlabs/tts'
import { injectAudio } from '@/lib/stagehand/audio-injector'
import type { BotBrowser } from '@/lib/stagehand/browser-manager'

export async function speakNode(state: BotStateType): Promise<Partial<BotStateType>> {
  const browser = state.browserHandle as BotBrowser | null
  const utterance = state.nextBotUtterance?.trim()
  if (!browser || !utterance || !state.isSessionActive) return {}

  try {
    const audioBuffer = await generateSpeech(utterance)
    await injectAudio(browser.page, audioBuffer)
    const timestampMs = Date.now() - state.sessionStartTime
    return {
      conversationHistory: [...state.conversationHistory, { speaker: 'bot', text: utterance, timestampMs }],
      nextBotUtterance: '',
      currentStep: 'listen',
    }
  } catch (error) {
    return {
      isSessionActive: false,
      errorMessage: error instanceof Error ? error.message : 'Speech injection failed',
    }
  }
}
