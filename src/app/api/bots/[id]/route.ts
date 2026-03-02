import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: bot, error } = await supabase
    .from('bots')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  // Verify user owns the workspace this bot belongs to
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('user_id')
    .eq('id', bot.workspace_id)
    .single()

  if (!workspace || workspace.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: transcriptEntries } = await supabase
    .from('transcript_entries')
    .select('*')
    .eq('bot_id', id)
    .order('timestamp_ms')

  return NextResponse.json({ bot, transcriptEntries: transcriptEntries || [] })
}
