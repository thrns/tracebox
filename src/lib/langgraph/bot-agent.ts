import { createAdminClient } from '@/lib/supabase/admin'
import { closeBotBrowser, createBotBrowser } from '@/lib/stagehand/browser-manager'

export interface BotRunConfig {
  botId: string
  workspaceId: string
  targetUrl: string
  instructions: string
  maxDuration: number
  llmProvider: 'openai' | 'gemini'
}

/**
 * First execution slice: open one isolated browser session and persist its
 * terminal state. The richer conversation graph is layered on later.
 */
export async function runBot(config: BotRunConfig): Promise<void> {
  const supabase = createAdminClient()
  let browser: Awaited<ReturnType<typeof createBotBrowser>> | null = null

  await supabase
    .from('bots')
    .update({ status: 'connecting', started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', config.botId)

  try {
    browser = await createBotBrowser({ targetUrl: config.targetUrl })
    await browser.page.goto(config.targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

    await supabase
      .from('bots')
      .update({ status: 'complete', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', config.botId)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await supabase
      .from('bots')
      .update({ status: 'error', error_message: message, updated_at: new Date().toISOString() })
      .eq('id', config.botId)
    throw error
  } finally {
    if (browser) await closeBotBrowser(browser)
  }
}

export async function spawnBots(workspaceId: string): Promise<void> {
  const supabase = createAdminClient()
  const { data: workspace } = await supabase.from('workspaces').select('*').eq('id', workspaceId).single()
  if (!workspace) throw new Error('Workspace not found')

  const { data: bots } = await supabase
    .from('bots')
    .select('id, bot_number')
    .eq('workspace_id', workspaceId)
    .eq('status', 'queued')
    .order('bot_number')

  await Promise.all(
    (bots ?? []).map((bot) => runBot({
      botId: bot.id,
      workspaceId,
      targetUrl: workspace.target_url,
      instructions: workspace.instructions ?? '',
      maxDuration: workspace.max_session_duration,
      llmProvider: workspace.llm_provider as 'openai' | 'gemini',
    }).catch((error) => console.error(`[Bot #${bot.bot_number}]`, error)))
  )
}
