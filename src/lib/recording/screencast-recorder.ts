import type { CdpSessionLike } from '@/lib/stagehand/browser-manager'
import { spawn, type ChildProcess } from 'child_process'
import { createAdminClient } from '@/lib/supabase/admin'
import type { RealtimeChannel } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

export interface ScreencastHandle {
  cdpSession: CdpSessionLike
  ffmpegProcess: ChildProcess
  outputPath: string
  frameCount: number
  stopped: boolean
  liveChannel: RealtimeChannel | null
}

const log = (botId: string, msg: string, data?: unknown) =>
  console.log(`[screencast][${botId.slice(0, 8)}] ${msg}`, data !== undefined ? data : '')

export async function startScreencastRecording(
  cdpSession: CdpSessionLike,
  outputDir: string,
  botId: string
): Promise<ScreencastHandle> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const outputPath = path.join(outputDir, `${botId}-screen.webm`)

  // Spawn FFmpeg to encode JPEG frames piped to stdin into a WebM file
  const ffmpegProcess = spawn(
    'ffmpeg',
    [
      '-y',
      '-f', 'image2pipe',
      '-framerate', '10',
      '-i', 'pipe:0',
      '-c:v', 'libvpx',
      '-b:v', '200k',   // keep files under Supabase's 50MB upload limit for ~60min sessions
      '-crf', '20',
      '-auto-alt-ref', '0',
      outputPath,
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] }
  )

  ffmpegProcess.on('error', (err) => {
    log(botId, 'FFmpeg process error', err)
    throw new Error(`FFmpeg failed to start: ${err.message}`)
  })

  // Swallow write-after-end errors that can occur when frames arrive after stop
  ffmpegProcess.stdin?.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code !== 'EPIPE' && err.code !== 'ERR_STREAM_WRITE_AFTER_END') {
      log(botId, 'FFmpeg stdin error', err)
    }
  })

  ffmpegProcess.stderr?.on('data', (data: Buffer) => {
    // FFmpeg writes progress to stderr — only log errors
    const msg = data.toString()
    if (msg.includes('Error') || msg.includes('error')) {
      log(botId, 'FFmpeg stderr', msg.trim())
    }
  })

  // Set up Supabase Realtime Broadcast channel for live viewing.
  // Every BROADCAST_EVERY_N frames (~1fps at 10fps capture), the raw base64 JPEG
  // is broadcast to any UI clients subscribed to this bot's live channel.
  const BROADCAST_EVERY_N = 10
  let liveChannel: RealtimeChannel | null = null
  try {
    const supabase = createAdminClient()
    liveChannel = supabase.channel(`bot:${botId}:live`)
    await liveChannel.subscribe()
    log(botId, 'Live broadcast channel ready')
  } catch (err) {
    log(botId, 'Warning: could not set up live broadcast channel', err)
    liveChannel = null
  }

  const handle: ScreencastHandle = {
    cdpSession,
    ffmpegProcess,
    outputPath,
    frameCount: 0,
    stopped: false,
    liveChannel,
  }

  // Start CDP screencast — Chrome fires Page.screencastFrame events
  await cdpSession.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 60,
    maxWidth: 1280,
    maxHeight: 720,
    everyNthFrame: 3, // ~10fps when Chrome renders at ~30fps
  })

  cdpSession.on<{ sessionId: number; data: string }>('Page.screencastFrame', async (event) => {
    try {
      // Acknowledge regardless so Chrome doesn't queue up pending frames
      await cdpSession.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {})

      if (handle.stopped) return

      const frameBuffer = Buffer.from(event.data, 'base64')
      handle.frameCount++

      // Write JPEG frame to FFmpeg stdin (guard against writableEnded race)
      const stdin = handle.ffmpegProcess.stdin
      if (stdin && !stdin.writableEnded && !stdin.destroyed) {
        stdin.write(frameBuffer)
      }

      // Broadcast every Nth frame for live viewing (~1fps)
      if (handle.liveChannel && handle.frameCount % BROADCAST_EVERY_N === 0) {
        handle.liveChannel.send({
          type: 'broadcast',
          event: 'frame',
          payload: { data: event.data },
        }).catch(() => {})
      }
    } catch {
      // Frame errors are non-fatal — Chrome may have already moved on
    }
  })

  log(botId, `Screencast started → ${outputPath}`)
  return handle
}

export async function stopScreencastRecording(handle: ScreencastHandle): Promise<string> {
  // Set flag first so the frame handler ignores any in-flight frames
  handle.stopped = true

  // Tear down live broadcast channel
  if (handle.liveChannel) {
    handle.liveChannel.send({
      type: 'broadcast',
      event: 'ended',
      payload: {},
    }).catch(() => {})
    handle.liveChannel.unsubscribe().catch(() => {})
    handle.liveChannel = null
  }

  try {
    await handle.cdpSession.send('Page.stopScreencast')
  } catch {
    // Page may already be closed
  }

  return new Promise((resolve, reject) => {
    // Close stdin so FFmpeg knows the stream ended
    const stdin = handle.ffmpegProcess.stdin
    if (stdin && !stdin.writableEnded && !stdin.destroyed) {
      stdin.end()
    }

    if (handle.frameCount === 0) {
      // No frames captured — kill FFmpeg and resolve with empty path
      handle.ffmpegProcess.kill()
      resolve('')
      return
    }

    const timeout = setTimeout(() => {
      handle.ffmpegProcess.kill()
      resolve(handle.outputPath) // resolve anyway with whatever was written
    }, 15_000)

    handle.ffmpegProcess.on('close', (code) => {
      clearTimeout(timeout)
      if (code === 0 || fs.existsSync(handle.outputPath)) {
        resolve(handle.outputPath)
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`))
      }
    })
  })
}
