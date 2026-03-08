import { StateGraph, END } from '@langchain/langgraph'
import { BotState, type BotStateType } from './state'
import { navigateNode } from './nodes/navigate'
import { setupNode } from './nodes/setup'
import { listenNode } from './nodes/listen'
import { transcribeNode } from './nodes/transcribe'
import { reasonNode } from './nodes/reason'
import { actNode } from './nodes/act'
import { speakNode } from './nodes/speak'
import { finalizeNode } from './nodes/finalize'
import { createAdminClient } from '@/lib/supabase/admin'

function withTiming(
  name: string,
  fn: (state: BotStateType) => Promise<Partial<BotStateType>>
) {
  return async (state: BotStateType): Promise<Partial<BotStateType>> => {
    const start = Date.now()
    const result = await fn(state)
    const durationMs = Date.now() - start
    return {
      ...result,
      nodeTimings: { ...(state.nodeTimings || {}), [name]: durationMs },
    }
  }
}

const botGraph = new StateGraph(BotState)
  .addNode('navigate', withTiming('navigate', navigateNode))
  .addNode('setup', withTiming('setup', setupNode))
  .addNode('listen', withTiming('listen', listenNode))
  .addNode('transcribe', withTiming('transcribe', transcribeNode))
  .addNode('reason', withTiming('reason', reasonNode))
  .addNode('act', withTiming('act', actNode))
  .addNode('speak', withTiming('speak', speakNode))
  .addNode('finalize', finalizeNode)

  .addEdge('__start__', 'navigate')
  .addConditionalEdges('navigate', (state) => {
    if (!state.isSessionActive || state.errorMessage) return 'finalize'
    return 'setup'
  })
  .addConditionalEdges('setup', (state) => {
    if (!state.isSessionActive) return 'finalize'
    if (state.setupComplete) return 'listen'
    return 'setup'
  })
  .addEdge('listen', 'transcribe')
  .addEdge('transcribe', 'reason')
  .addConditionalEdges('reason', (state) => {
    if (!state.isSessionActive) return 'finalize'
    return 'act'
  })
  .addConditionalEdges('act', (state) => {
    if (!state.isSessionActive) return 'finalize'
    if (state.nextBotUtterance?.trim()) return 'speak'
    return 'listen'
  })
  .addEdge('speak', 'listen')
  .addEdge('finalize', END)

export const botAgent = botGraph.compile()

export interface BotRunConfig {
  botId: string
  workspaceId: string
  targetUrl: string
  instructions: string
  maxDuration: number
  llmProvider: 'openai' | 'gemini'
}

export async function runBot(config: BotRunConfig): Promise<void> {
  // Each turn = ~5 node invocations (listen→transcribe→reason→speak→listen).
  // Add generous headroom so the wall-clock maxDuration check always fires first.
  const recursionLimit = Math.max(500, config.maxDuration * 10)

  await botAgent.invoke(
    {
      botId: config.botId,
      workspaceId: config.workspaceId,
      targetUrl: config.targetUrl,
      instructions: config.instructions,
      maxDuration: config.maxDuration,
      llmProvider: config.llmProvider,
      sessionStartTime: Date.now(),
      currentStep: 'navigate',
      conversationHistory: [],
      actionHistory: [],
      lastSystemUtterance: '',
      nextBotUtterance: '',
      isSessionActive: false,
      setupComplete: false,
      turnCount: 0,
      recordingFilePath: '',
      audioChunks: [],
      errorMessage: null,
      retryCount: 0,
      browserHandle: null,
      screencastHandle: null,
      nextStagehandAction: '',
      screenshotUrls: [],
      takeScreenshot: false,
      latestScreenshotBuffer: null,
      consecutiveEmptyTurns: 0,
      consecutiveBotSpeaksNoResponse: 0,
      nodeTimings: {},
    },
    { recursionLimit },
  )
}

export async function spawnBots(workspaceId: string): Promise<void> {
  const supabase = createAdminClient()

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .single()

  if (!workspace) throw new Error('Workspace not found')

  const instructions = workspace.instructions ?? ''

  // Only run bots from the latest run (queued status = freshly created)
  const { data: bots } = await supabase
    .from('bots')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'queued')
    .order('bot_number')

  if (!bots || bots.length === 0) return

  // Stagger browser launches: Chrome needs ~3-4s to fully initialize its CDP
  // endpoint. Launching all instances simultaneously starves the CPU and causes
  // Stagehand's internal timeout to fire before Chrome is ready.
  // We start each bot with a fixed offset so Chrome processes initialize one
  // at a time before the next one competes for CPU.
  const LAUNCH_STAGGER_MS = parseInt(process.env.BOT_LAUNCH_STAGGER_MS || '4000')

  const botTasks = bots.map((bot, index) =>
    (async () => {
      // Wait for this bot's staggered slot before starting
      if (index > 0) {
        await new Promise((r) => setTimeout(r, index * LAUNCH_STAGGER_MS))
      }
      console.log(`[Bot #${bot.bot_number}] Starting (slot ${index})`)
      try {
        await runBot({
          botId: bot.id,
          workspaceId,
          targetUrl: workspace.target_url,
          instructions,
          maxDuration: workspace.max_session_duration,
          llmProvider: workspace.llm_provider as 'openai' | 'gemini',
        })
        console.log(`[Bot #${bot.bot_number}] Completed`)
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        const stack = error instanceof Error ? error.stack : ''
        console.error(`[Bot #${bot.bot_number}] Error: ${msg}`)
        console.error(stack)
        await supabase
          .from('bots')
          .update({
            status: 'error',
            error_message: msg,
            updated_at: new Date().toISOString(),
          })
          .eq('id', bot.id)
      }
    })()
  )

  await Promise.allSettled(botTasks)
}
