import type { BrowserContext } from 'playwright'
import path from 'path'
import fs from 'fs'

export function setupScreenRecording(context: BrowserContext, recordingDir: string) {
  if (!fs.existsSync(recordingDir)) {
    fs.mkdirSync(recordingDir, { recursive: true })
  }
  // Playwright recordVideo is set at context creation time
  // This function is a no-op placeholder; recording is configured in browser-manager
  return recordingDir
}

export async function getRecordingPath(
  context: BrowserContext,
  outputDir: string,
  botId: string
): Promise<string | null> {
  try {
    const pages = context.pages()
    if (pages.length === 0) return null

    const page = pages[0]
    const video = page.video()
    if (!video) return null

    const finalPath = path.join(outputDir, `${botId}-screen.webm`)

    // Save the video to the final path
    await video.saveAs(finalPath)
    return finalPath
  } catch {
    return null
  }
}
