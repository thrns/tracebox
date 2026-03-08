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
  conversationHistory: Annotation<Array<{
    speaker: 'bot' | 'system'
    text: string
    timestampMs: number
  }>>,
  lastSystemUtterance: Annotation<string>,
  audioChunks: Annotation<Array<Buffer>>,
  isSessionActive: Annotation<boolean>,
  setupComplete: Annotation<boolean>,
  turnCount: Annotation<number>,
  nextBotUtterance: Annotation<string>,
  nextStagehandAction: Annotation<string>,
  takeScreenshot: Annotation<boolean>,
  recordingFilePath: Annotation<string>,
  screencastHandle: Annotation<unknown>,
  screenshotUrls: Annotation<Array<string>>,
  latestScreenshotBuffer: Annotation<Buffer | null>,
  consecutiveEmptyTurns: Annotation<number>,
  consecutiveBotSpeaksNoResponse: Annotation<number>,
  nodeTimings: Annotation<Record<string, number>>,
  browserHandle: Annotation<unknown>,
  errorMessage: Annotation<string | null>,
  retryCount: Annotation<number>,
})

export type BotStateType = typeof BotState.State
