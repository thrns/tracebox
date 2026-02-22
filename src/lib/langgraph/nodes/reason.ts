import type { BotStateType } from '../state'
import type { BotBrowser } from '@/lib/stagehand/browser-manager'
import { decideNextAction } from '@/lib/llm/reasoning'
import { botLog } from '@/lib/logging/bot-logger'

const log = (botId: string, msg: string, data?: unknown) =>
  botLog(botId, 'reason', data !== undefined ? msg + ' ' + String(data) : msg)

const STUCK_THRESHOLD = 3

export async function reasonNode(state: BotStateType): Promise<Partial<BotStateType>> {
  if (!state.isSessionActive) {
    log(state.botId, 'Skipping — session inactive')
    return { isSessionActive: false }
  }

  const elapsed = (Date.now() - state.sessionStartTime) / 1000
  if (elapsed >= state.maxDuration) {
    log(state.botId, `Timeout (${elapsed.toFixed(1)}s)`)
    return { isSessionActive: false }
  }

  // Safety valve: end after 20 turns with no system audio response.
  const MAX_SILENT_TURNS = 20
  const systemTurns = state.conversationHistory.filter((e) => e.speaker === 'system').length
  if (state.turnCount >= MAX_SILENT_TURNS && systemTurns === 0) {
    log(state.botId, `Ending — ${MAX_SILENT_TURNS} turns with no system audio response`)
    return { isSessionActive: false }
  }

  const nextTurnCount = state.turnCount + 1
  const stuckTurns = state.consecutiveBotSpeaksNoResponse ?? 0
  log(state.botId, `Reasoning (turn ${nextTurnCount}, history: ${state.conversationHistory.length}, provider: ${state.llmProvider})`)

  // When stuck (bot spoke N times with zero tutor response), proactively take a
  // fresh screenshot BEFORE calling the LLM so it can see the current page state
  // and decide what browser action to take (MCQ click, code editor, etc.)
  let screenshotForReasoning = state.latestScreenshotBuffer ?? undefined
  const stateUpdates: Partial<BotStateType> = {}

  if (stuckTurns >= STUCK_THRESHOLD) {
    log(state.botId, `STUCK (${stuckTurns} bot turns no response) — taking fresh screenshot for visual reasoning`)
    try {
      const browser = state.browserHandle as BotBrowser | null
      if (browser) {
        const freshBuffer = await browser.page.screenshot({ type: 'png' })
        screenshotForReasoning = freshBuffer
        stateUpdates.latestScreenshotBuffer = freshBuffer
        log(state.botId, 'Fresh screenshot captured for stuck recovery')
      }
    } catch (err) {
      log(state.botId, 'Could not take fresh screenshot (non-fatal)', err)
    }
  }

  try {
    const decision = await decideNextAction({
      instructions: state.instructions,
      conversationHistory: state.conversationHistory,
      actionHistory: state.actionHistory ?? [],
      llmProvider: state.llmProvider,
      latestScreenshot: screenshotForReasoning,
      consecutiveEmptyTurns: state.consecutiveEmptyTurns ?? 0,
      consecutiveBotSpeaksNoResponse: stuckTurns,
    })

    log(state.botId, `Decision — utterance: "${decision.utterance}" | action: "${decision.stagehandAction}" | screenshot: ${decision.takeScreenshot} | end: ${decision.shouldEnd}`)

    return {
      ...stateUpdates,
      turnCount: nextTurnCount,
      nextBotUtterance: decision.utterance,
      nextStagehandAction: decision.stagehandAction,
      takeScreenshot: decision.takeScreenshot,
      isSessionActive: !decision.shouldEnd,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Reasoning failed'
    log(state.botId, `ERROR: ${errorMessage}`, error)
    return {
      ...stateUpdates,
      turnCount: nextTurnCount,
      errorMessage,
      isSessionActive: false,
      nextBotUtterance: '',
      nextStagehandAction: '',
      takeScreenshot: false,
    }
  }
}
