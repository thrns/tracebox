import type { BotStateType } from '../state'
import type { BotBrowser } from '@/lib/stagehand/browser-manager'

export async function actNode(state: BotStateType): Promise<Partial<BotStateType>> {
  const browser = state.browserHandle as BotBrowser | null
  const action = state.nextStagehandAction?.trim()
  if (!browser || !action || !state.isSessionActive) {
    return { nextStagehandAction: '', takeScreenshot: false }
  }

  try {
    await browser.stagehand.act(action)
    return {
      actionHistory: [...state.actionHistory, action],
      nextStagehandAction: '',
      takeScreenshot: false,
      currentStep: 'listen',
    }
  } catch (error) {
    return {
      actionHistory: [...state.actionHistory, 'FAILED: ' + action],
      nextStagehandAction: '',
      takeScreenshot: false,
      errorMessage: error instanceof Error ? error.message : 'Browser action failed',
    }
  }
}
