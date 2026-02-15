import type { BotStateType } from '../state'
import type { BotBrowser } from '@/lib/stagehand/browser-manager'
import { closeBotBrowser } from '@/lib/stagehand/browser-manager'
import { stopAudioRecording, saveAudioBuffer } from '@/lib/recording/audio-recorder'
import { stopScreencastRecording, type ScreencastHandle } from '@/lib/recording/screencast-recorder'
import { muxVideoAudio } from '@/lib/recording/muxer'
import { createAdminClient } from '@/lib/supabase/admin'
import fs from 'fs'
import path from 'path'

export async function finalizeNode(state: BotStateType): Promise<Partial<BotStateType>> {
  const supabase = createAdminClient()
  const browser = state.browserHandle as BotBrowser | null
  const duration = Math.floor((Date.now() - state.sessionStartTime) / 1000)

  await supabase
    .from('bots')
    .update({ status: 'uploading', updated_at: new Date().toISOString() })
    .eq('id', state.botId)

  let recordingFilePath: string | null = null
  const tmpDir = '/tmp/tracebox/' + state.workspaceId + '/' + state.botId
  try {
    if (browser) {
      const audio = await stopAudioRecording(browser.page)
      const screencast = state.screencastHandle as ScreencastHandle | null
      const screenPath = screencast ? await stopScreencastRecording(screencast) : ''
      let uploadBuffer = audio
      let contentType = 'audio/webm'

      if (screenPath && audio.length > 0) {
        const audioPath = await saveAudioBuffer(audio, tmpDir, state.botId)
        const finalPath = path.join(tmpDir, state.botId + '-final.webm')
        muxVideoAudio(screenPath, audioPath, finalPath)
        uploadBuffer = fs.readFileSync(finalPath)
        contentType = 'video/webm'
      } else if (screenPath && fs.existsSync(screenPath)) {
        uploadBuffer = fs.readFileSync(screenPath)
        contentType = 'video/webm'
      }

      if (uploadBuffer.length > 0) {
        const storagePath = state.workspaceId + '/' + state.botId + '/recording.webm'
        const { error } = await supabase.storage.from('recordings').upload(storagePath, audio, {
          contentType,
          upsert: true,
        })
        if (!error) recordingFilePath = storagePath
      }
      await closeBotBrowser(browser)
    }

    if (state.conversationHistory.length > 0) {
      await supabase.from('transcript_entries').insert(state.conversationHistory.map((entry) => ({
        bot_id: state.botId,
        speaker: entry.speaker,
        text: entry.text,
        timestamp_ms: entry.timestampMs,
      })))
    }

    await supabase
      .from('bots')
      .update({
        status: 'complete',
        session_duration_seconds: duration,
        recording_file_path: recordingFilePath,
        transcript_json: state.conversationHistory,
        langgraph_trace: state.nodeTimings,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', state.botId)

    return { recordingFilePath: recordingFilePath ?? '', currentStep: 'done' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Finalization failed'
    await supabase
      .from('bots')
      .update({ status: 'error', error_message: message, updated_at: new Date().toISOString() })
      .eq('id', state.botId)
    if (browser) await closeBotBrowser(browser).catch(() => {})
    return { errorMessage: message, currentStep: 'done' }
  }
}
