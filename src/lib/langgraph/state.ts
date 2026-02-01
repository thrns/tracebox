import { Annotation } from '@langchain/langgraph'

export const BotState = Annotation.Root({
  botId: Annotation<string>,
  workspaceId: Annotation<string>,
  targetUrl: Annotation<string>,
  instructions: Annotation<string>,
  maxDuration: Annotation<number>,
  llmProvider: Annotation<'openai' | 'gemini'>,
  sessionStartTime: Annotation<number>,
  currentStep: Annotation<string>,
  actionHistory: Annotation<Array<string>>,
  isSessionActive: Annotation<boolean>,
  setupComplete: Annotation<boolean>,
  browserHandle: Annotation<unknown>,
  errorMessage: Annotation<string | null>,
})

export type BotStateType = typeof BotState.State
