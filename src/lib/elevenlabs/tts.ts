import { ElevenLabsClient } from 'elevenlabs'

let _client: ElevenLabsClient | null = null
function getClient() {
  if (!_client) _client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY })
  return _client
}

export async function generateSpeech(text: string, voiceId?: string): Promise<Buffer> {
  const audio = await getClient().textToSpeech.convert(
    voiceId || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM',
    {
      text,
      model_id: 'eleven_turbo_v2_5',
      output_format: 'pcm_16000',
    }
  )

  const chunks: Buffer[] = []
  for await (const chunk of audio) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}
