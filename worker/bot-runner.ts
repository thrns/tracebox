import { spawnBots, runBot } from '../src/lib/langgraph/bot-agent'
import { createAdminClient } from '../src/lib/supabase/admin'

/**
 * Run a single bot and mark the workspace as completed/failed when all bots are done.
 * Each call runs exactly one Chrome instance — designed for one-bot-per-Cloud-Run-instance.
 */
export async function runSingleBot(botId: string, workspaceId: string): Promise<void> {
  console.log(`[Worker] Starting single bot ${botId} (workspace ${workspaceId})`)
  const supabase = createAdminClient()

  try {
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('target_url, instructions, max_session_duration, llm_provider')
      .eq('id', workspaceId)
      .single()

    if (!workspace) throw new Error('Workspace not found')

    await runBot({
      botId,
      workspaceId,
      targetUrl: workspace.target_url,
      instructions: workspace.instructions ?? '',
      maxDuration: workspace.max_session_duration,
      llmProvider: workspace.llm_provider as 'openai' | 'gemini',
    })

    console.log(`[Worker] Bot ${botId} completed`)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[Worker] Bot ${botId} error: ${msg}`)
    console.error(error instanceof Error ? error.stack : '')

    await supabase
      .from('bots')
      .update({ status: 'error', error_message: msg, updated_at: new Date().toISOString() })
      .eq('id', botId)
  }

  // Check if all bots in workspace are done and update workspace status
  try {
    const { data: allBots } = await supabase
      .from('bots')
      .select('status')
      .eq('workspace_id', workspaceId)

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
          .eq('id', workspaceId)
        console.log(`[Worker] Workspace ${workspaceId} marked as ${anyFailed ? 'failed' : 'completed'}`)
      }
    }
  } catch (err) {
    console.error(`[Worker] Failed to check workspace completion:`, err)
  }
}

/** Legacy: run all bots in one container (local dev / docker-compose) */
export async function runWorkspace(workspaceId: string): Promise<void> {
  console.log(`[Worker] Starting workspace ${workspaceId}`)
  const supabase = createAdminClient()

  try {
    await spawnBots(workspaceId)
    console.log(`[Worker] Workspace ${workspaceId} completed`)

    await supabase
      .from('workspaces')
      .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', workspaceId)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : ''
    console.error(`[Worker] Workspace ${workspaceId} failed: ${msg}`)
    console.error(stack)

    await supabase
      .from('workspaces')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', workspaceId)
  }
}
