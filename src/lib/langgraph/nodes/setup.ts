import type { BotStateType } from '../state'
import type { BotBrowser } from '@/lib/stagehand/browser-manager'
import { decideSetupAction } from '@/lib/llm/reasoning'

const MAX_SETUP_TURNS = 30

export async function setupNode(state: BotStateType): Promise<Partial<BotStateType>> {
  const browser = state.browserHandle as BotBrowser | null
  if (!browser || !state.isSessionActive) return { isSessionActive: false }

  if ((state.actionHistory ?? []).length >= MAX_SETUP_TURNS) {
    return { isSessionActive: false, errorMessage: 'Setup exceeded maximum turns' }
  }

  const currentUrl = await browser.page.evaluate(() => window.location.href).catch(() => state.targetUrl)
  const decision = await decideSetupAction({
    instructions: state.instructions,
    actionHistory: state.actionHistory ?? [],
    currentUrl,
    llmProvider: state.llmProvider,
  })

  if (decision.shouldEnd) {
    return { isSessionActive: false, errorMessage: 'Setup ended by LLM' }
  }
  if (decision.setupComplete) return { setupComplete: true, currentStep: 'ready' }

  const history = [...(state.actionHistory ?? [])]
  if (decision.navigateToUrl.trim()) {
    await browser.page.goto(decision.navigateToUrl.trim(), { waitUntil: 'domcontentloaded', timeout: 30000 })
    history.push('navigated to ' + decision.navigateToUrl.trim())
  } else if (decision.stagehandAction.trim()) {
    await browser.stagehand.act(decision.stagehandAction)
    history.push(decision.stagehandAction)
  }

  return { actionHistory: history }
}
