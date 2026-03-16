import type { BotStateType } from '../state'
import { createAdminClient } from '@/lib/supabase/admin'
import { createBotBrowser } from '@/lib/stagehand/browser-manager'
import { setupAudioCapture } from '@/lib/stagehand/audio-capture'
import { startScreencastRecording } from '@/lib/recording/screencast-recorder'
import { botLog } from '@/lib/logging/bot-logger'

const log = (botId: string, msg: string, data?: unknown) =>
  botLog(botId, 'navigate', data !== undefined ? msg + ' ' + String(data) : msg)

export async function navigateNode(state: BotStateType): Promise<Partial<BotStateType>> {
  const supabase = createAdminClient()
  log(state.botId, `Starting — target: ${state.targetUrl}`)

  await supabase
    .from('bots')
    .update({ status: 'connecting', started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', state.botId)

  // Declared outside try so the error path can return them for finalize cleanup
  let browser: Awaited<ReturnType<typeof createBotBrowser>> | null = null
  let screencastHandle: Awaited<ReturnType<typeof startScreencastRecording>> | null = null

  try {
    log(state.botId, 'Creating browser...')
    browser = await createBotBrowser({ targetUrl: state.targetUrl })
    const { page } = browser
    log(state.botId, 'Browser created')

    // Start screen recording via CDP screencast → FFmpeg (mandatory)
    const tmpDir = `/tmp/tracebox/${state.workspaceId}/${state.botId}`
    screencastHandle = await startScreencastRecording(browser.cdpSession, tmpDir, state.botId)
    log(state.botId, 'Screen recording started')

    // Hook RTCPeerConnection BEFORE page loads so remote audio tracks are captured
    await setupAudioCapture(page)
    log(state.botId, 'Audio capture hook installed')

    // Enable CDP Runtime domain and log all browser console errors + uncaught exceptions
    // so we can see exactly what crashes the session page.
    try {
      await browser.cdpSession.send('Runtime.enable')
      browser.cdpSession.on('Runtime.exceptionThrown', (params: unknown) => {
        const p = params as { exceptionDetails?: { exception?: { description?: string }; text?: string } }
        const desc = p?.exceptionDetails?.exception?.description ?? p?.exceptionDetails?.text ?? JSON.stringify(params)
        log(state.botId, `[BROWSER EXCEPTION] ${desc}`)
      })
      browser.cdpSession.on('Runtime.consoleAPICalled', (params: unknown) => {
        const p = params as { type?: string; args?: Array<{ value?: unknown; description?: string }> }
        if (p?.type === 'error') {
          const msg = p.args?.map((a) => a.value ?? a.description ?? '').join(' ') ?? ''
          log(state.botId, `[BROWSER CONSOLE ERROR] ${msg}`)
        }
      })
    } catch (err) {
      log(state.botId, 'Warning: could not enable CDP Runtime logging', err)
    }

    log(state.botId, 'Navigating to target URL...')
    await page.goto(state.targetUrl, { waitUntil: 'domcontentloaded', timeoutMs: 30000 })
    log(state.botId, 'Page loaded')

    await supabase
      .from('bots')
      .update({ status: 'running', updated_at: new Date().toISOString() })
      .eq('id', state.botId)

    // Take an initial screenshot so the first reasoning turn has visual context
    let initialScreenshotUrls: string[] = []
    try {
      const screenshotBuffer = await page.screenshot({ type: 'png' })
      const storagePath = `${state.workspaceId}/${state.botId}/screenshot-navigate.png`
      const { error: uploadError } = await supabase.storage
        .from('screenshots')
        .upload(storagePath, screenshotBuffer, { contentType: 'image/png', upsert: true })
      if (uploadError) {
        log(state.botId, 'Warning: screenshot upload failed', uploadError.message)
      } else {
        const { data: urlData } = supabase.storage.from('screenshots').getPublicUrl(storagePath)
        initialScreenshotUrls = [urlData.publicUrl]
        log(state.botId, `Initial screenshot captured: ${urlData.publicUrl}`)
        // Write to DB immediately so the UI shows it during the live run
        await supabase
          .from('bots')
          .update({ screenshot_urls: initialScreenshotUrls, updated_at: new Date().toISOString() })
          .eq('id', state.botId)
      }
    } catch (err) {
      log(state.botId, 'Warning: could not take initial screenshot', err)
    }

    log(state.botId, 'Navigate complete — entering setup phase')
    return {
      browserHandle: browser,
      screencastHandle,
      sessionStartTime: Date.now(),
      isSessionActive: true,
      currentStep: 'setup',
      turnCount: 0,
      conversationHistory: [],
      screenshotUrls: initialScreenshotUrls,
      takeScreenshot: false,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Navigation failed'
    log(state.botId, `ERROR: ${errorMessage}`, error)
    await supabase
      .from('bots')
      .update({ status: 'error', error_message: errorMessage, updated_at: new Date().toISOString() })
      .eq('id', state.botId)

    // Pass browser and screencastHandle to state so finalize can clean them up and save the recording
    return {
      browserHandle: browser,
      screencastHandle,
      errorMessage,
      isSessionActive: false,
    }
  }
}
