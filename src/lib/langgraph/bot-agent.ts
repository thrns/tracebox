import { END, StateGraph } from '@langchain/langgraph'
import { BotState, type BotStateType } from './state'
import { navigateNode } from './nodes/navigate'
import { setupNode } from './nodes/setup'
import { listenNode } from './nodes/listen'
import { transcribeNode } from './nodes/transcribe'
import { reasonNode } from './nodes/reason'
import { actNode } from './nodes/act'
import { speakNode } from './nodes/speak'
import { createAdminClient } from '@/lib/supabase/admin'
import { botLog } from '@/lib/logging/bot-logger'
import { finalizeNode } from './nodes/finalize'

function withTiming(name: string, fn: (state: BotStateType) => Promise<Partial<BotStateType>>) {
  return async (state: BotStateType): Promise<Partial<BotStateType>> => {
    const started = Date.now()
    const result = await fn(state)
    const durationMs = Date.now() - started
    botLog(state.botId, name, 'completed in ' + durationMs + 'ms')
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
  .addNode('finish', withTiming('finish', finalizeNode))
  .addEdge('__start__', 'navigate')
  .addConditionalEdges('navigate', (state) => state.isSessionActive ? 'setup' : 'finish')
  .addConditionalEdges('setup', (state) => {
    if (!state.isSessionActive) return 'finish'
    if (state.setupComplete) return 'listen'
    return 'setup'
  })
  .addEdge('listen', 'transcribe')
  .addEdge('transcribe', 'reason')
  .addConditionalEdges('reason', (state) => state.isSessionActive ? 'act' : 'finish')
  .addConditionalEdges('act', (state) => {
    if (!state.isSessionActive) return 'finish'
    return state.nextBotUtterance.trim() ? 'speak' : 'listen'
  })
  .addEdge('speak', 'listen')
  .addEdge('finish', END)

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
  await botAgent.invoke({
    ...config,
    sessionStartTime: Date.now(),
    currentStep: 'navigate',
    actionHistory: [],
    conversationHistory: [],
    lastSystemUtterance: '',
    audioChunks: [],
    isSessionActive: false,
    setupComplete: false,
    turnCount: 0,
    nextBotUtterance: '',
    nextStagehandAction: '',
    takeScreenshot: false,
    recordingFilePath: '',
    screencastHandle: null,
    screenshotUrls: [],
    latestScreenshotBuffer: null,
    nodeTimings: {},
    browserHandle: null,
    errorMessage: null,
  })
}

export async function spawnBots(workspaceId: string): Promise<void> {
  const supabase = createAdminClient()
  const { data: workspace } = await supabase.from('workspaces').select('*').eq('id', workspaceId).single()
  if (!workspace) throw new Error('Workspace not found')
  const { data: bots } = await supabase.from('bots').select('id').eq('workspace_id', workspaceId).eq('status', 'queued')

  await Promise.all((bots ?? []).map((bot) => runBot({
    botId: bot.id,
    workspaceId,
    targetUrl: workspace.target_url,
    instructions: workspace.instructions ?? '',
    maxDuration: workspace.max_session_duration,
    llmProvider: workspace.llm_provider as 'openai' | 'gemini',
  })))
}
