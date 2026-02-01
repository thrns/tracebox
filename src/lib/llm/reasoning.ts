import OpenAI from 'openai'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'

let openai: OpenAI | null = null
function getOpenAI() {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return openai
}

function getGemini() {
  return new ChatGoogleGenerativeAI({
    model: 'gemini-2.0-flash',
    apiKey: process.env.GEMINI_API_KEY,
    temperature: 0.3,
  })
}

function parseJSON<T>(raw: string, fallback: T): T {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return fallback
  try {
    return { ...fallback, ...JSON.parse(match[0]) }
  } catch {
    return fallback
  }
}

export interface SetupDecision {
  stagehandAction: string
  navigateToUrl: string
  setupComplete: boolean
  shouldEnd: boolean
}

export async function decideSetupAction(config: {
  instructions: string
  actionHistory: Array<string>
  currentUrl: string
  llmProvider: 'openai' | 'gemini'
}): Promise<SetupDecision> {
  const prompt = 'You are a browser test bot in a setup phase.\n' +
    'Reach the live session described by these instructions:\n' + config.instructions + '\n\n' +
    'Current URL: ' + config.currentUrl + '\n' +
    'Completed actions:\n' + (config.actionHistory.length ? config.actionHistory.join('\n') : '(none)') + '\n\n' +
    'Choose one next browser action, or mark setupComplete when the live session is ready.\n' +
    'Return only JSON with navigateToUrl, stagehandAction, setupComplete, and shouldEnd.'

  const fallback = { stagehandAction: '', navigateToUrl: '', setupComplete: false, shouldEnd: false }
  if (config.llmProvider === 'gemini') {
    const response = await getGemini().invoke([{ role: 'human', content: prompt }])
    const raw = typeof response.content === 'string' ? response.content : ''
    return parseJSON(raw, fallback)
  }

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4.1',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  })
  return parseJSON(response.choices[0].message.content || '{}', fallback)
}
