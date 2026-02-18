import type { BotStateType } from '../state'
import { createAdminClient } from '@/lib/supabase/admin'
import { createBotBrowser } from '@/lib/stagehand/browser-manager'
import { startScreencastRecording } from '@/lib/recording/screencast-recorder'

export async function navigateNode(state: BotStateType): Promise<Partial<BotStateType>> {
  const supabase = createAdminClient()
  let browser: Awaited<ReturnType<typeof createBotBrowser>> | null = null
  let screencastHandle: Awaited<ReturnType<typeof startScreencastRecording>> | null = null
  let latestScreenshotBuffer: Buffer | null = null
  let screenshotUrls: string[] = []

  await supabase
    .from('bots')
    .update({ status: 'connecting', started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', state.botId)

  try {
    browser = await createBotBrowser({ targetUrl: state.targetUrl })
    screencastHandle = await startScreencastRecording(
      browser.cdpSession,
      '/tmp/tracebox/' + state.workspaceId + '/' + state.botId,
      state.botId,
    )
    await browser.page.goto(state.targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await supabase
      .from('bots')
      .update({ status: 'running', updated_at: new Date().toISOString() })
      .eq('id', state.botId)

    try {
      latestScreenshotBuffer = await browser.page.screenshot({ type: 'png' })
      const storagePath = state.workspaceId + '/' + state.botId + '/screenshot-navigate.png'
      const { error } = await supabase.storage.from('screenshots').upload(storagePath, latestScreenshotBuffer, {
        contentType: 'image/png',
        upsert: true,
      })
      if (!error) {
        const { data } = supabase.storage.from('screenshots').getPublicUrl(storagePath)
        screenshotUrls = [data.publicUrl]
      }
    } catch {
      latestScreenshotBuffer = null
    }

    return {
      browserHandle: browser,
      screencastHandle,
      screenshotUrls,
      latestScreenshotBuffer,
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
    return { browserHandle: browser, screencastHandle, errorMessage, isSessionActive: false }
  }
}
