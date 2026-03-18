import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (apiKey !== process.env.WORKER_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const {
    botId,
    workspaceId,
    status,
    errorMessage,
    sessionDurationSeconds,
    recordingFilePath,
    recordingUrl,
    transcriptJson,
    langgraphTrace,
  } = body

  const adminSupabase = createAdminClient()

  // Update bot record
  await adminSupabase
    .from('bots')
    .update({
      status,
      error_message: errorMessage || null,
      session_duration_seconds: sessionDurationSeconds || null,
      recording_file_path: recordingFilePath || null,
      recording_url: recordingUrl || null,
      transcript_json: transcriptJson || null,
      langgraph_trace: langgraphTrace || null,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', botId)

  // Save transcript entries
  if (transcriptJson && transcriptJson.length > 0) {
    const entries = transcriptJson.map((entry: { speaker: string; text: string; timestampMs: number }) => ({
      bot_id: botId,
      speaker: entry.speaker,
      text: entry.text,
      timestamp_ms: entry.timestampMs,
    }))
    await adminSupabase.from('transcript_entries').insert(entries)
  }

  // Check if all bots in workspace are done
  const { data: allBots } = await adminSupabase
    .from('bots')
    .select('status')
    .eq('workspace_id', workspaceId)

  if (allBots) {
    const allDone = allBots.every((b) => b.status === 'complete' || b.status === 'error')
    if (allDone) {
      const anyFailed = allBots.some((b) => b.status === 'error')
      await adminSupabase
        .from('workspaces')
        .update({
          status: anyFailed ? 'failed' : 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', workspaceId)
    }
  }

  return NextResponse.json({ success: true })
}
