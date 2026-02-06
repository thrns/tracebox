import type { BotStateType } from '../state'
import { decideNextAction } from '@/lib/llm/reasoning'

export async function reasonNode(state: BotStateType): Promise<Partial<BotStateType>> {
  try {
    const decision = await decideNextAction({
      instructions: state.instructions,
      conversationHistory: state.conversationHistory,
      actionHistory: state.actionHistory,
      lastSystemUtterance: state.lastSystemUtterance,
      llmProvider: state.llmProvider,
    })

    return {
      turnCount: state.turnCount + 1,
      nextBotUtterance: decision.utterance,
      nextStagehandAction: decision.stagehandAction,
      takeScreenshot: decision.takeScreenshot,
      isSessionActive: !decision.shouldEnd,
      currentStep: 'act',
    }
  } catch (error) {
    return {
      isSessionActive: false,
      errorMessage: error instanceof Error ? error.message : 'Reasoning failed',
    }
  }
}
