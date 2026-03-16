import type { BotStateType } from '../state'
import type { BotBrowser } from '@/lib/stagehand/browser-manager'
import { decideSetupAction } from '@/lib/llm/reasoning'
import { startAudioRecording } from '@/lib/recording/audio-recorder'
import { createAdminClient } from '@/lib/supabase/admin'
import { botLog } from '@/lib/logging/bot-logger'

const log = (botId: string, msg: string, data?: unknown) =>
  botLog(botId, 'setup', data !== undefined ? msg + ' ' + String(data) : msg)

const MAX_SETUP_TURNS = 50

export async function setupNode(state: BotStateType): Promise<Partial<BotStateType>> {
  const browser = state.browserHandle as BotBrowser | null
  if (!browser || !state.isSessionActive) {
    log(state.botId, 'Skipping — no browser or session inactive')
    return { isSessionActive: false }
  }

  const elapsed = (Date.now() - state.sessionStartTime) / 1000
  if (elapsed >= state.maxDuration) {
    log(state.botId, `Timeout during setup (${elapsed.toFixed(1)}s)`)
    return { isSessionActive: false }
  }

  const setupTurn = (state.actionHistory ?? []).length + 1
  if (setupTurn > MAX_SETUP_TURNS) {
    log(state.botId, `Setup exceeded ${MAX_SETUP_TURNS} turns — aborting`)
    return { isSessionActive: false, errorMessage: 'Setup exceeded maximum turns' }
  }

  log(state.botId, `Setup step ${setupTurn} (provider: ${state.llmProvider})`)

  const supabase = createAdminClient()

  try {
    // Get current URL so the LLM knows where the browser is
    let currentUrl = ''
    try {
      currentUrl = await browser.page.evaluate(() => window.location.href)
    } catch {
      currentUrl = state.targetUrl
    }

    const decision = await decideSetupAction({
      instructions: state.instructions,
      actionHistory: state.actionHistory ?? [],
      currentUrl,
      llmProvider: state.llmProvider,
      latestScreenshot: state.latestScreenshotBuffer ?? undefined,
    })

    log(state.botId, `Decision — navigate: "${decision.navigateToUrl}" | action: "${decision.stagehandAction}" | setupComplete: ${decision.setupComplete} | end: ${decision.shouldEnd}`)

    if (decision.shouldEnd) {
      // Before giving up, check if the page is showing an error and try reloading
      try {
        const pageTitle = await browser.page.evaluate(() => document.title)
        const bodyText = await browser.page.evaluate(() => document.body?.innerText?.slice(0, 200) ?? '')
        log(state.botId, `Page state on shouldEnd — title: "${pageTitle}" | body: "${bodyText}"`)
        if (bodyText.includes('Application error') || bodyText.includes('client-side exception')) {
          log(state.botId, 'Page crashed — reloading and retrying')
          await browser.page.evaluate(() => window.location.reload())
          await new Promise((r) => setTimeout(r, 3000))
          return {} // retry setup loop
        }
      } catch {
        // ignore
      }
      return { isSessionActive: false, errorMessage: 'Setup ended by LLM (unrecoverable)' }
    }

    if (decision.setupComplete) {
      log(state.botId, 'Setup complete — starting audio recording and transitioning to session loop')
      try {
        await startAudioRecording(browser.page)
        log(state.botId, 'Audio recording started')
      } catch (err) {
        log(state.botId, 'Warning: could not start audio recording', err)
      }
      return { setupComplete: true }
    }

    const updates: Partial<BotStateType> = {}

    if (decision.navigateToUrl?.trim()) {
      const url = decision.navigateToUrl.trim()
      log(state.botId, `Navigating to: ${url}`)
      try {
        await browser.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
        log(state.botId, 'Navigation complete')
        updates.actionHistory = [...(state.actionHistory ?? []), `navigated to ${url}`]
      } catch (err) {
        log(state.botId, 'Navigation failed (non-fatal)', err)
        updates.actionHistory = [...(state.actionHistory ?? []), `FAILED: navigate to ${url}`]
      }
      await new Promise((r) => setTimeout(r, 2000))
    } else if (decision.stagehandAction.trim()) {
      log(state.botId, `Executing: "${decision.stagehandAction}"`)
      try {
        await browser.stagehand.act(decision.stagehandAction)
        log(state.botId, 'Action complete')
        updates.actionHistory = [...(state.actionHistory ?? []), decision.stagehandAction]
      } catch (err) {
        log(state.botId, 'Action failed (non-fatal)', err)
        updates.actionHistory = [...(state.actionHistory ?? []), `FAILED: ${decision.stagehandAction}`]
      }
      await new Promise((r) => setTimeout(r, 1500))
    } else {
      log(state.botId, 'No action — waiting for page to settle')
      await new Promise((r) => setTimeout(r, 2000))
    }

    // Always take a screenshot after each setup step.
    // The buffer is kept in memory for the next LLM call (passed as base64 data URL).
    // It is also uploaded to Supabase for the UI — but we never pass the remote URL
    // to OpenAI because OpenAI times out trying to download Supabase storage URLs.
    try {
      const screenshotBuffer = await browser.page.screenshot({ type: 'png' })
      updates.latestScreenshotBuffer = screenshotBuffer

      const storagePath = `${state.workspaceId}/${state.botId}/screenshot-setup-${Date.now()}.png`
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

    return updates
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Setup failed'
    log(state.botId, `ERROR: ${errorMessage}`, error)
    return { errorMessage, isSessionActive: false }
  }
}
