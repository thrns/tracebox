import { Stagehand } from '@browserbasehq/stagehand'
import fs from 'fs'

/** Minimal CDP session interface — matches Stagehand's CDPSessionLike and Playwright's CDPSession */
export interface CdpSessionLike {
  send<R = unknown>(method: string, params?: object): Promise<R>
  on<P = unknown>(event: string, handler: (params: P) => void): void
  off<P = unknown>(event: string, handler: (params: P) => void): void
}

/** Minimal shape of Stagehand's internal Page needed for CDP access */
interface StagehandInternalPage {
  mainFrameId(): string
  getSessionForFrame(frameId: string): CdpSessionLike
  addInitScript(script: string | (() => void)): Promise<void>
  evaluate<T>(fn: () => T | Promise<T>): Promise<T>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  evaluate<T, A>(fn: (arg: A) => T | Promise<T>, arg: A): Promise<T>
  goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<unknown>
  screenshot(options?: { type?: string; fullPage?: boolean }): Promise<Buffer>
}

export interface BotBrowser {
  stagehand: Stagehand
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any
  cdpSession: CdpSessionLike
}

async function resolveChromeExecutablePath(): Promise<string | undefined> {
  if (process.env.CHROME_EXECUTABLE_PATH) return process.env.CHROME_EXECUTABLE_PATH
  try {
    const { chromium } = await import('playwright')
    const p = chromium.executablePath()
    return fs.existsSync(p) ? p : undefined
  } catch {
    return undefined
  }
}

export async function createBotBrowser(config: {
  targetUrl?: string
  ttsAudioPath?: string
  recordingDir?: string
}): Promise<BotBrowser> {
  const stagehand = new Stagehand({
    env: 'LOCAL',
    verbose: 0,
    localBrowserLaunchOptions: {
      headless: true,
      executablePath: await resolveChromeExecutablePath(),
      args: [
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        '--autoplay-policy=no-user-gesture-required',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-extensions',
        // WebGL is stubbed in the page init script (audio-capture.ts) so the app
        // doesn't crash when canvas.getContext('webgl') returns null in headless mode.
        // We don't pass --use-gl=swiftshader because headless Chrome on Mac/Linux
        // ignores it and still returns null — the JS stub is the reliable fix.
        ...(process.platform === 'linux' ? ['--no-zygote'] : []),
        ...(config.ttsAudioPath
          ? [`--use-file-for-fake-audio-capture=${config.ttsAudioPath}`]
          : []),
      ],
    },
    model: {
      modelName: 'openai/gpt-4o-mini',
      apiKey: process.env.OPENAI_API_KEY,
    },
  })

  await stagehand.init()

  // stagehand.context is Stagehand's internal V3Context (not a Playwright BrowserContext).
  // We access the active page and its main CDP session through the internal API.
  const internalContext = stagehand.context as unknown as {
    activePage(): StagehandInternalPage | undefined
    conn: { send(method: string, params?: object): Promise<unknown> }
  }
  const page = internalContext.activePage() as StagehandInternalPage
  if (!page) throw new Error('Stagehand: no active page after init')

  // Get the main CDP session directly from the Stagehand page — this has .send()/.on()/.off()
  const cdpSession = page.getSessionForFrame(page.mainFrameId())

  // Grant microphone and camera permissions at the browser level via CDP.
  // This ensures navigator.permissions.query() returns 'granted' and
  // getUserMedia() succeeds without prompts in headless mode.
  const rootConn = internalContext.conn
  try {
    await rootConn.send('Browser.grantPermissions', {
      permissions: ['audioCapture', 'videoCapture'],
    })
  } catch {
    // Fallback: try per-permission via Browser.setPermission
    for (const name of ['audioCapture', 'videoCapture']) {
      try {
        await rootConn.send('Browser.setPermission', {
          permission: { name },
          setting: 'granted',
        })
      } catch {
        // Best effort — fake-media flags should still work
      }
    }
  }

  return { stagehand, page, cdpSession }
}

export async function closeBotBrowser(browser: BotBrowser) {
  try {
    await browser.stagehand.close()
  } catch {
    // ignore close errors
  }
}
