import type { BotStateType } from '../state'
import { captureSystemAudio } from '@/lib/stagehand/audio-capture'
import type { BotBrowser } from '@/lib/stagehand/browser-manager'
import { createAdminClient } from '@/lib/supabase/admin'
import { botLog } from '@/lib/logging/bot-logger'

const log = (botId: string, msg: string, data?: unknown) =>
  botLog(botId, 'listen', data !== undefined ? msg + ' ' + String(data) : msg)

export async function listenNode(state: BotStateType): Promise<Partial<BotStateType>> {
  const browser = state.browserHandle as BotBrowser
  if (!browser || !state.isSessionActive) {
    log(state.botId, 'Skipping — no browser or session inactive')
    return { isSessionActive: false }
  }

  const supabase = createAdminClient()
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('status')
    .eq('id', state.workspaceId)
    .single()

  if (workspace?.status === 'stopped') {
    log(state.botId, 'Workspace stopped — ending session')
    return { isSessionActive: false }
  }

  const elapsed = (Date.now() - state.sessionStartTime) / 1000
  if (elapsed >= state.maxDuration) {
    log(state.botId, `Session timeout (${elapsed.toFixed(1)}s >= ${state.maxDuration}s)`)
    return { isSessionActive: false }
  }

  await supabase
    .from('bots')
    .update({ status: 'running', updated_at: new Date().toISOString() })
    .eq('id', state.botId)

  // Allow up to 90s per turn so long tutor explanations aren't cut mid-sentence.
  // The VAD silence detector will stop early (after ~2s of confirmed silence) for
  // short utterances — the 90s cap is only hit if the tutor speaks continuously.
  const maxMs = Math.min(120000, (state.maxDuration - elapsed) * 1000)
  log(state.botId, `Listening for up to ${(maxMs / 1000).toFixed(1)}s (turn ${state.turnCount + 1})`)

  try {
    const audioBuffer = await captureSystemAudio(browser.page, {
      silenceThreshold: 0.005,
      silenceDurationMs: 2000, // wait at least 2s of confirmed silence before stopping
      maxDurationMs: maxMs,
    })

    log(state.botId, `Captured ${audioBuffer.length} bytes of audio`)

    return {
      audioChunks: audioBuffer.length > 0 ? [audioBuffer] : [],
      currentStep: 'transcribe',
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Listen failed'
    log(state.botId, `ERROR: ${errorMessage}`, error)
    return {
      errorMessage,
      isSessionActive: false,
    }
  }
}
