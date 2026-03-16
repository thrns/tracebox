import { Annotation } from '@langchain/langgraph'

export const BotState = Annotation.Root({
  // Config (set once at start)
  botId: Annotation<string>,
  workspaceId: Annotation<string>,
  targetUrl: Annotation<string>,
  instructions: Annotation<string>,
  maxDuration: Annotation<number>,
  llmProvider: Annotation<'openai' | 'gemini'>,

  // Runtime state
  sessionStartTime: Annotation<number>,
  currentStep: Annotation<string>,
  conversationHistory: Annotation<
    Array<{
      speaker: 'bot' | 'system'
      text: string
      timestampMs: number
    }>
  >,
  actionHistory: Annotation<Array<string>>,
  lastSystemUtterance: Annotation<string>,
  nextBotUtterance: Annotation<string>,
  isSessionActive: Annotation<boolean>,
  setupComplete: Annotation<boolean>,
  turnCount: Annotation<number>,

  // Recording state
  recordingFilePath: Annotation<string>,
  audioChunks: Annotation<Array<Buffer>>,

  // Error handling
  errorMessage: Annotation<string | null>,
  retryCount: Annotation<number>,

  // Browser handle (passed through state)
  browserHandle: Annotation<unknown>,

  // Screencast handle (CDP screencast + FFmpeg process)
  screencastHandle: Annotation<unknown>,

  // Browser action decided by the LLM for the act node to execute
  nextStagehandAction: Annotation<string>,

  // Screenshots taken during the session (public URLs)
  screenshotUrls: Annotation<Array<string>>,

  // Whether the LLM requested a screenshot this turn
  takeScreenshot: Annotation<boolean>,

  // Latest screenshot as a raw PNG buffer — passed inline to the LLM as base64.
  // Never stored remotely; avoids OpenAI timing out on Supabase URLs.
  latestScreenshotBuffer: Annotation<Buffer | null>,

  // How many consecutive listen turns returned an empty transcript.
  // Resets to 0 whenever a non-empty transcript is received.
  // Used by the reason node to detect "tutor is waiting for a response" situations.
  consecutiveEmptyTurns: Annotation<number>,

  // How many consecutive turns the bot has spoken without receiving any system response.
  // Resets to 0 whenever a non-empty system transcript is received.
  // Used to detect "stuck" situations where the bot is speaking but the tutor isn't responding
  // (e.g. a coding/MCQ question is on screen waiting for interaction).
  consecutiveBotSpeaksNoResponse: Annotation<number>,

  // Per-node execution timings (ms) — saved to langgraph_trace at finalize
  nodeTimings: Annotation<Record<string, number>>,
})

export type BotStateType = typeof BotState.State
