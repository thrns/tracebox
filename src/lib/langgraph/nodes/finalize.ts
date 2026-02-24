import type { BotStateType } from '../state'
import { createAdminClient } from '@/lib/supabase/admin'
import { closeBotBrowser } from '@/lib/stagehand/browser-manager'
import { stopAudioRecording, saveAudioBuffer } from '@/lib/recording/audio-recorder'
import { stopScreencastRecording, type ScreencastHandle } from '@/lib/recording/screencast-recorder'
import { muxVideoAudio } from '@/lib/recording/muxer'
import { cleanupBroadcastChannel } from '@/lib/supabase/broadcast'
import { botLog, getBotLogs, clearBotLogs } from '@/lib/logging/bot-logger'
import type { BotBrowser } from '@/lib/stagehand/browser-manager'
import fs from 'fs'
import path from 'path'

const log = (botId: string, msg: string, data?: unknown) =>
  botLog(botId, 'finalize', data !== undefined ? msg + ' ' + String(data) : msg)

export async function finalizeNode(state: BotStateType): Promise<Partial<BotStateType>> {
  const supabase = createAdminClient()
  const browser = state.browserHandle as BotBrowser | null
  log(state.botId, `Starting — turns: ${state.turnCount}, history: ${state.conversationHistory.length} entries, error: ${state.errorMessage || 'none'}`)

  await supabase
    .from('bots')
    .update({ status: 'uploading', updated_at: new Date().toISOString() })
    .eq('id', state.botId)

  const sessionDuration = Math.floor((Date.now() - state.sessionStartTime) / 1000)
  const tmpDir = `/tmp/tracebox/${state.workspaceId}/${state.botId}`
  let recordingUrl: string | null = null
  let recordingFilePath: string | null = null

  try {
    if (browser) {
      // Stop audio recording
      let audioBuffer: Buffer | null = null
      try {
        audioBuffer = await stopAudioRecording(browser.page)
        log(state.botId, `Audio recording stopped: ${audioBuffer.length} bytes`)
      } catch (err) {
        log(state.botId, 'Warning: stopAudioRecording failed', err)
      }

      // Stop screen recording (CDP screencast → FFmpeg → WebM)
      let screenPath: string | null = null
      try {
        const handle = state.screencastHandle as ScreencastHandle | null
        if (handle) {
          const result = await stopScreencastRecording(handle)
          screenPath = result && result.length > 0 ? result : null
          log(state.botId, screenPath ? `Screen recording saved: ${screenPath} (${handle.frameCount} frames)` : 'Screen recording produced no output')
        } else {
          log(state.botId, 'Warning: no screencast handle in state')
        }
      } catch (err) {
        log(state.botId, 'Warning: stopScreencastRecording failed', err)
      }

      // Mux video + audio if both available
      if (screenPath && audioBuffer && audioBuffer.length > 0) {
        log(state.botId, 'Muxing screen + audio...')
        const audioPath = await saveAudioBuffer(audioBuffer, tmpDir, state.botId)
        const outputPath = path.join(tmpDir, `${state.botId}-final.webm`)

        try {
          muxVideoAudio(screenPath, audioPath, outputPath)
          const recordingBuffer = fs.readFileSync(outputPath)
          const storagePath = `${state.workspaceId}/${state.botId}/recording.webm`
          log(state.botId, `Uploading muxed recording (${recordingBuffer.length} bytes)...`)

          const { error: uploadError } = await supabase.storage
            .from('recordings')
            .upload(storagePath, recordingBuffer, {
              contentType: 'video/webm',
              upsert: true,
            })

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('recordings')
              .getPublicUrl(storagePath)
            recordingUrl = urlData.publicUrl
            recordingFilePath = storagePath
            log(state.botId, `Muxed recording uploaded: ${recordingUrl}`)
          } else {
            log(state.botId, 'Upload error (muxed):', uploadError)
          }
        } catch (muxErr) {
          log(state.botId, 'Muxing failed — uploading screen only', muxErr)
          if (screenPath && fs.existsSync(screenPath)) {
            const screenBuffer = fs.readFileSync(screenPath)
            const storagePath = `${state.workspaceId}/${state.botId}/recording.webm`
            const { error: uploadError } = await supabase.storage
              .from('recordings')
              .upload(storagePath, screenBuffer, { contentType: 'video/webm', upsert: true })

            if (!uploadError) {
              const { data: urlData } = supabase.storage
                .from('recordings')
                .getPublicUrl(storagePath)
              recordingUrl = urlData.publicUrl
              recordingFilePath = storagePath
              log(state.botId, `Screen-only recording uploaded: ${recordingUrl}`)
            } else {
              log(state.botId, 'Upload error (screen-only fallback):', uploadError)
            }
          }
        }
      } else if (screenPath && fs.existsSync(screenPath)) {
        log(state.botId, 'No audio — uploading screen-only recording...')
        const screenBuffer = fs.readFileSync(screenPath)
        const storagePath = `${state.workspaceId}/${state.botId}/recording.webm`
        const { error: uploadError } = await supabase.storage
          .from('recordings')
          .upload(storagePath, screenBuffer, { contentType: 'video/webm', upsert: true })

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('recordings')
            .getPublicUrl(storagePath)
          recordingUrl = urlData.publicUrl
          recordingFilePath = storagePath
          log(state.botId, `Screen-only recording uploaded: ${recordingUrl}`)
        } else {
          log(state.botId, 'Upload error (screen-only):', uploadError)
        }
      } else if (audioBuffer && audioBuffer.length > 0) {
        // Audio only — no screen recording (Stagehand v3 limitation)
        log(state.botId, 'No screen recording available — uploading audio-only...')
        const audioPath = await saveAudioBuffer(audioBuffer, tmpDir, state.botId)
        const audioFileBuffer = fs.readFileSync(audioPath)
        const storagePath = `${state.workspaceId}/${state.botId}/recording.webm`
        const { error: uploadError } = await supabase.storage
          .from('recordings')
          .upload(storagePath, audioFileBuffer, { contentType: 'audio/webm', upsert: true })

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('recordings')
            .getPublicUrl(storagePath)
          recordingUrl = urlData.publicUrl
          recordingFilePath = storagePath
          log(state.botId, `Audio-only recording uploaded: ${recordingUrl}`)
        } else {
          log(state.botId, 'Upload error (audio-only):', uploadError)
        }
      } else {
        log(state.botId, 'No screen or audio data to upload')
      }

      await closeBotBrowser(browser)
    }

    // Save transcript entries
    if (state.conversationHistory.length > 0) {
      const entries = state.conversationHistory.map((entry) => ({
        bot_id: state.botId,
        speaker: entry.speaker,
        text: entry.text,
        timestamp_ms: entry.timestampMs,
      }))
      await supabase.from('transcript_entries').insert(entries)
    }

    // Collect all server logs accumulated during this bot's run
    const serverLogs = getBotLogs(state.botId)

    // Update bot record
    log(state.botId, `Saving to DB — duration: ${sessionDuration}s, transcript: ${state.conversationHistory.length} entries, recording: ${recordingUrl || 'none'}, screenshots: ${(state.screenshotUrls ?? []).length}, logs: ${serverLogs.length}, trace nodes: ${Object.keys(state.nodeTimings ?? {}).join(', ') || 'none'}`)
    await supabase
      .from('bots')
      .update({
        status: 'complete',
        session_duration_seconds: sessionDuration,
        recording_file_path: recordingFilePath,
        recording_url: recordingUrl,
        transcript_json: state.conversationHistory,
        screenshot_urls: state.screenshotUrls ?? [],
        langgraph_trace: state.nodeTimings ?? {},
        server_logs: serverLogs,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', state.botId)
    log(state.botId, 'DB update complete')
    clearBotLogs(state.botId)

    // Check if all bots in workspace are done
    const { data: allBots } = await supabase
      .from('bots')
      .select('status')
      .eq('workspace_id', state.workspaceId)

    if (allBots) {
      const allDone = allBots.every((b) => b.status === 'complete' || b.status === 'error')
      if (allDone) {
        const anyFailed = allBots.some((b) => b.status === 'error')
        await supabase
          .from('workspaces')
          .update({
            status: anyFailed ? 'failed' : 'completed',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', state.workspaceId)
      }
    }

    // Cleanup temp files and live broadcast channel
    cleanupBroadcastChannel(state.botId)
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }

    return {
      recordingFilePath: recordingFilePath || '',
      currentStep: 'done',
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Finalization failed'

    cleanupBroadcastChannel(state.botId)

    if (browser) {
      try {
        await closeBotBrowser(browser)
      } catch {
        // ignore
      }
    }

    const errorLogs = getBotLogs(state.botId)
    await supabase
      .from('bots')
      .update({
        status: 'error',
        error_message: errorMessage,
        session_duration_seconds: sessionDuration,
        transcript_json: state.conversationHistory,
        screenshot_urls: state.screenshotUrls ?? [],
        server_logs: errorLogs,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', state.botId)
    clearBotLogs(state.botId)

    return {
      errorMessage,
    }
  }
}
