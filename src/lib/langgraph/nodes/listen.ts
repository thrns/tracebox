import type { BotStateType } from '../state'
import { captureSystemAudio } from '@/lib/stagehand/audio-capture'
import type { BotBrowser } from '@/lib/stagehand/browser-manager'
import { createAdminClient } from '@/lib/supabase/admin'

export async function listenNode(state: BotStateType): Promise<Partial<BotStateType>> {
  const browser = state.browserHandle as BotBrowser | null
  if (!browser || !state.isSessionActive) return { isSessionActive: false }

  const { data: workspace } = await createAdminClient()
    .from('workspaces')
    .select('status')
    .eq('id', state.workspaceId)
    .single()
  if (workspace?.status === 'stopped') return { isSessionActive: false }

  const elapsed = (Date.now() - state.sessionStartTime) / 1000
  if (elapsed >= state.maxDuration) return { isSessionActive: false }

  await createAdminClient()
    .from('bots')
    .update({ status: 'running', updated_at: new Date().toISOString() })
    .eq('id', state.botId)

  try {
    const audio = await captureSystemAudio(browser.page, {
      silenceThreshold: 0.01,
      silenceDurationMs: 1500,
      maxDurationMs: Math.min(30000, (state.maxDuration - elapsed) * 1000),
    })
    return { audioChunks: audio.length > 0 ? [audio] : [], currentStep: 'transcribe' }
  } catch (error) {
    return {
      isSessionActive: false,
      errorMessage: error instanceof Error ? error.message : 'Listen failed',
    }
  }
}
