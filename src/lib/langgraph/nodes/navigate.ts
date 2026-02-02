import type { BotStateType } from '../state'
import { createAdminClient } from '@/lib/supabase/admin'
import { createBotBrowser } from '@/lib/stagehand/browser-manager'

export async function navigateNode(state: BotStateType): Promise<Partial<BotStateType>> {
  const supabase = createAdminClient()
  let browser: Awaited<ReturnType<typeof createBotBrowser>> | null = null

  await supabase
    .from('bots')
    .update({ status: 'connecting', started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', state.botId)

  try {
    browser = await createBotBrowser({ targetUrl: state.targetUrl })
    await browser.page.goto(state.targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await supabase
      .from('bots')
      .update({ status: 'running', updated_at: new Date().toISOString() })
      .eq('id', state.botId)

    return {
      browserHandle: browser,
      sessionStartTime: Date.now(),
      isSessionActive: true,
      currentStep: 'setup',
      actionHistory: [],
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Navigation failed'
    await supabase
      .from('bots')
      .update({ status: 'error', error_message: errorMessage, updated_at: new Date().toISOString() })
      .eq('id', state.botId)
    return { browserHandle: browser, errorMessage, isSessionActive: false }
  }
}
