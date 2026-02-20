import type { BotStateType } from '../state'
import type { BotBrowser } from '@/lib/stagehand/browser-manager'
import { createAdminClient } from '@/lib/supabase/admin'
import { botLog } from '@/lib/logging/bot-logger'

const log = (botId: string, msg: string, data?: unknown) =>
  botLog(botId, 'act', data !== undefined ? msg + ' ' + String(data) : msg)

export async function actNode(state: BotStateType): Promise<Partial<BotStateType>> {
  const browser = state.browserHandle as BotBrowser | null
  const hasAction = state.nextStagehandAction?.trim()
  const needsScreenshot = state.takeScreenshot

  if (!browser || (!hasAction && !needsScreenshot)) {
    return { nextStagehandAction: '', takeScreenshot: false }
  }

  const supabase = createAdminClient()
  const updates: Partial<BotStateType> = {
    nextStagehandAction: '',
    takeScreenshot: false,
  }

  // Execute Stagehand browser action
  if (hasAction) {
    log(state.botId, `Executing: "${state.nextStagehandAction}"`)
    try {
      await browser.stagehand.act(state.nextStagehandAction)
      log(state.botId, 'Action complete')
      updates.actionHistory = [...(state.actionHistory ?? []), state.nextStagehandAction]
    } catch (err) {
      log(state.botId, 'Action failed (non-fatal)', err)
      updates.actionHistory = [...(state.actionHistory ?? []), `FAILED: ${state.nextStagehandAction}`]
    }
  }

  // Take a screenshot after every browser action (or when explicitly requested).
  // The buffer is stored in state for inline base64 passing to the LLM.
  // It is also uploaded to Supabase for the UI — but never passed as a URL to OpenAI.
  if (hasAction || needsScreenshot) {
    try {
      const screenshotBuffer = await browser.page.screenshot({ type: 'png' })
      updates.latestScreenshotBuffer = screenshotBuffer

      const storagePath = `${state.workspaceId}/${state.botId}/screenshot-${Date.now()}.png`
      const { error: uploadError } = await supabase.storage
        .from('screenshots')
        .upload(storagePath, screenshotBuffer, { contentType: 'image/png', upsert: true })

      if (uploadError) {
        log(state.botId, 'Screenshot upload failed (non-fatal)', uploadError.message)
      } else {
        const { data: urlData } = supabase.storage.from('screenshots').getPublicUrl(storagePath)
        const url = urlData.publicUrl
        log(state.botId, `Screenshot: ${url}`)
        const updatedUrls = [...(state.screenshotUrls ?? []), url]
        updates.screenshotUrls = updatedUrls
        await supabase
          .from('bots')
          .update({ screenshot_urls: updatedUrls, updated_at: new Date().toISOString() })
          .eq('id', state.botId)
      }
    } catch (err) {
      log(state.botId, 'Screenshot failed (non-fatal)', err)
    }
  }

  return updates
}
