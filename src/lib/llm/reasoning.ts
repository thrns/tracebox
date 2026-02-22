import OpenAI from 'openai'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

function getGemini() {
  return new ChatGoogleGenerativeAI({
    model: 'gemini-2.0-flash',
    apiKey: process.env.GEMINI_API_KEY,
    temperature: 0.3,
  })
}

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

// Accept a raw PNG buffer and encode it as a base64 data URL inline.
// This avoids OpenAI trying to download a Supabase URL (which times out).
async function callLLM(
  prompt: string,
  provider: 'openai' | 'gemini',
  screenshotBuffer?: Buffer,
): Promise<string> {
  const content: ContentPart[] = [{ type: 'text', text: prompt }]
  if (screenshotBuffer && screenshotBuffer.length > 0) {
    const dataUrl = `data:image/png;base64,${screenshotBuffer.toString('base64')}`
    content.push({ type: 'image_url', image_url: { url: dataUrl } })
  }

  if (provider === 'openai') {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4.1',
      messages: [{ role: 'user', content }],
      response_format: { type: 'json_object' },
    })
    return response.choices[0].message.content || '{}'
  }

  const gemini = getGemini()
  const response = await gemini.invoke([{ role: 'human', content }])
  return typeof response.content === 'string' ? response.content : ''
}

function parseJSON<T>(raw: string, fallback: T): T {
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return fallback
  try { return { ...fallback, ...JSON.parse(jsonMatch[0]) } } catch { return fallback }
}

// ---------------------------------------------------------------------------
// Setup phase — browser-only actions (login, navigation, clicking through UI)
// ---------------------------------------------------------------------------

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
  latestScreenshot?: Buffer
}): Promise<SetupDecision> {
  const actionHistoryText = config.actionHistory.length === 0
    ? '(no browser actions taken yet)'
    : config.actionHistory.map((a, i) => `${i + 1}. ${a}`).join('\n')

  const prompt = `You are a test automation bot controlling a real web browser. You are in the SETUP PHASE — your job is to perform browser actions to navigate through the UI and reach the actual session/interview page.

You have TWO capabilities per turn (use only one):
1. NAVIGATE: Go to a URL by setting "navigateToUrl" (use this when the instructions say to navigate/go to a specific URL, or when you need to reach a different page entirely)
2. INTERACT: Perform ONE physical browser interaction by setting "stagehandAction" (click, type, scroll, select, etc.)

CURRENT PAGE URL: ${config.currentUrl}

CRITICAL RULES:
- Use "navigateToUrl" ONLY for full URL navigation (e.g. "https://tutor.tracebox.com"). Set "stagehandAction" to "" when using this.
- Use "stagehandAction" for physical interactions: clicking buttons/links, filling text fields, selecting dropdowns, scrolling, etc.
- Valid stagehandAction examples: "click the Login button", "type atheeb@gmail.com in the email field", "click the course card titled DSA Upskilling"
- INVALID stagehandAction examples: "wait for audio", "listen to session", "record audio", "transcribe", "navigate to URL", "go to URL" — use navigateToUrl for URL navigation, and audio actions are handled by the system
- Do NOT repeat actions already completed in the history below
- After each action, the system takes a screenshot automatically so you can see the result
- Set "setupComplete": true ONLY when all pre-session browser setup steps are done and the live session/interview interface is loaded and ready for audio interaction
- Set "shouldEnd": true ONLY if something is fundamentally broken and the bot cannot proceed

FULL INSTRUCTIONS (for context — focus on the setup/navigation steps):
${config.instructions}

BROWSER ACTIONS ALREADY COMPLETED (in order):
${actionHistoryText}

Based on the screenshot of the current page state and the actions already taken, decide the NEXT single action to perform.

Respond ONLY with a JSON object:
{
  "navigateToUrl": "<full URL to navigate to, or empty string if not navigating>",
  "stagehandAction": "<ONE physical browser action, or empty string>",
  "setupComplete": <true if all setup steps are done and the session is ready for audio>,
  "shouldEnd": <true only if unrecoverable error>
}`

  const fallback: SetupDecision = { stagehandAction: '', navigateToUrl: '', setupComplete: false, shouldEnd: false }
  const raw = await callLLM(prompt, config.llmProvider, config.latestScreenshot)
  return parseJSON(raw, fallback)
}

// ---------------------------------------------------------------------------
// Session phase — audio loop (listen → transcribe → reason → act → speak)
// ---------------------------------------------------------------------------

export interface BotDecision {
  utterance: string
  stagehandAction: string
  takeScreenshot: boolean
  shouldEnd: boolean
}

export async function decideNextAction(config: {
  instructions: string
  conversationHistory: Array<{ speaker: string; text: string }>
  actionHistory: Array<string>
  llmProvider: 'openai' | 'gemini'
  latestScreenshot?: Buffer
  consecutiveEmptyTurns?: number
  consecutiveBotSpeaksNoResponse?: number
}): Promise<BotDecision> {
  const actionHistoryText = config.actionHistory.length === 0
    ? '(no browser actions taken yet)'
    : config.actionHistory.map((a, i) => `${i + 1}. ${a}`).join('\n')

  const emptyTurns = config.consecutiveEmptyTurns ?? 0
  const stuckTurns = config.consecutiveBotSpeaksNoResponse ?? 0

  // Build a situational hint so the LLM knows when it needs to break the silence
  let situationHint = ''

  if (stuckTurns >= 3) {
    // Bot has spoken 3+ times with zero system response — the tutor is waiting for
    // a browser interaction (MCQ click, code editor input, button press, etc.)
    situationHint = `
⚠️  STUCK ALERT (${stuckTurns} bot turns with no tutor response):
You have spoken ${stuckTurns} times in a row but the tutor has not responded at all. This means the tutor is waiting for you to DO something on the page — NOT just speak.

MANDATORY ACTIONS:
1. Set "takeScreenshot": true so you can see the current page state.
2. Look at the screenshot carefully. The page likely shows one of:
   - An MCQ question → click the correct answer option, then click Submit
   - A coding editor → type the solution code, click "Run Code", then click "Submit"
   - A button or form waiting for input → click or fill it
3. Set "stagehandAction" to the specific browser action needed (e.g. "click option A", "click the Submit button", "type the solution in the code editor").
4. Do NOT just speak again — speaking is not working. You must interact with the page.
5. If you genuinely cannot determine what to do from the screenshot, set "stagehandAction" to "take a screenshot" to get a fresh view.
`
  } else if (emptyTurns >= 2) {
    const lastBotEntry = [...config.conversationHistory].reverse().find((h) => h.speaker === 'bot')
    situationHint = `
SILENCE ALERT: The last ${emptyTurns} listen turn(s) returned empty transcripts — the tutor is NOT speaking. The tutor is likely waiting for YOUR response.
- Look at the conversation history to find the last thing the tutor said.
- If the tutor asked a question, answer it now via "utterance".
- Do NOT stay silent.
${lastBotEntry ? `Your last utterance was: "${lastBotEntry.text}"` : ''}
`
  }

  const prompt = `You are a test automation bot controlling a real web browser. The setup phase is complete — you are now in an ACTIVE AUDIO SESSION. The system is automatically capturing audio from the page.

You have two capabilities:
1. SPEAK: Say something aloud to a voice AI on the page (set "utterance")
2. CLICK/TYPE: Perform ONE physical browser interaction (set "stagehandAction")

CRITICAL RULES:
- stagehandAction MUST be a physical browser interaction: clicking a button, filling a text field, selecting a dropdown, scrolling, etc.
- INVALID stagehandActions: "wait for audio", "record audio", "transcribe audio", "listen to the session", "analyze the transcript", "convert to audio", "play audio" — these are NOT browser actions. The system handles audio capture/playback automatically.
- If you have nothing to click or type, set "stagehandAction" to "" — the system will continue listening for audio
- Do NOT repeat actions already in the history
- Set "shouldEnd": true when the session is complete or the conversation has naturally concluded
${situationHint}
INSTRUCTIONS:
${config.instructions}

BROWSER ACTIONS ALREADY TAKEN (in order):
${actionHistoryText}

SPOKEN CONVERSATION HISTORY:
${config.conversationHistory.length === 0 ? '(none — no audio has been heard yet)' : config.conversationHistory.map((h) => `[${h.speaker.toUpperCase()}]: ${h.text}`).join('\n')}

Respond ONLY with a JSON object:
{
  "utterance": "<text to say aloud, or empty string>",
  "stagehandAction": "<ONE physical browser action, or empty string>",
  "takeScreenshot": <true|false>,
  "shouldEnd": <true|false>
}`

  const fallback: BotDecision = { utterance: '', stagehandAction: '', takeScreenshot: false, shouldEnd: true }
  const raw = await callLLM(prompt, config.llmProvider, config.latestScreenshot)
  return parseJSON(raw, fallback)
}
