import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch workspace and verify ownership
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (wsError || !workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  if (workspace.status === 'running') {
    return NextResponse.json({ error: 'Test is already running' }, { status: 400 })
  }

  // Determine the next run_number (previous runs are preserved)
  const { data: maxRunRow } = await adminSupabase
    .from('bots')
    .select('run_number')
    .eq('workspace_id', id)
    .order('run_number', { ascending: false })
    .limit(1)
    .single()

  const nextRunNumber = (maxRunRow?.run_number ?? 0) + 1

  // Create bot rows for this run
  const botRows = Array.from({ length: workspace.bot_count }, (_, i) => ({
    workspace_id: id,
    bot_number: i + 1,
    run_number: nextRunNumber,
    status: 'queued' as const,
  }))

  const { error: botsError } = await adminSupabase.from('bots').insert(botRows)
  if (botsError) {
    return NextResponse.json({ error: botsError.message }, { status: 500 })
  }

  // Update workspace status
  await adminSupabase
    .from('workspaces')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  // Fetch the created bots (this run only) so we can dispatch each one individually
  const { data: createdBots } = await adminSupabase
    .from('bots')
    .select('id, bot_number')
    .eq('workspace_id', id)
    .eq('run_number', nextRunNumber)
    .order('bot_number')

  const workerUrl = process.env.WORKER_URL
  const apiKey = process.env.WORKER_API_KEY || ''

  if (workerUrl && createdBots) {
    // Fan out: one HTTP request per bot → Cloud Run auto-scales each to its own instance
    console.log(`[run] Dispatching ${createdBots.length} bots to ${workerUrl}/spawn-bot`)
    for (const bot of createdBots) {
      fetch(`${workerUrl}/spawn-bot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ botId: bot.id, workspaceId: id }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const body = await res.text().catch(() => '')
            console.error(`[run] Worker rejected bot #${bot.bot_number}: ${res.status} ${body}`)
          }
        })
        .catch((err) => {
          console.error(`[run] Failed to dispatch bot #${bot.bot_number}:`, err)
        })
    }
  } else if (!workerUrl) {
    console.log(`[run] No WORKER_URL — spawning bots in-process (workspace ${id})`)
    import('@/lib/langgraph/bot-agent').then(({ spawnBots }) => {
      spawnBots(id).catch(console.error)
    })
  }

  return NextResponse.json({ success: true, status: 'running' })
}
