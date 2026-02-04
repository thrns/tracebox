import { DeepgramClient } from '@deepgram/sdk'

let _deepgram: DeepgramClient | null = null
function getDeepgram() {
  if (!_deepgram) _deepgram = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY! })
  return _deepgram
}

export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  const result = await getDeepgram().listen.v1.media.transcribeFile(audioBuffer, {
    model: 'nova-2',
    smart_format: true,
    language: 'en',
  })

  // result is ListenV1Response | ListenV1AcceptedResponse
  if ('results' in result) {
    return result.results?.channels?.[0]?.alternatives?.[0]?.transcript || ''
  }
  return ''
}
