import { createAdminClient } from './admin'

const channelCache = new Map<string, ReturnType<ReturnType<typeof createAdminClient>['channel']>>()

function getOrCreateChannel(channelName: string) {
  let ch = channelCache.get(channelName)
  if (!ch) {
    const supabase = createAdminClient()
    ch = supabase.channel(channelName)
    ch.subscribe()
    channelCache.set(channelName, ch)
  }
  return ch
}

export function broadcastTranscript(
  botId: string,
  entry: { speaker: 'bot' | 'system'; text: string; timestampMs: number }
) {
  try {
    const ch = getOrCreateChannel(`bot:${botId}:live`)
    ch.send({
      type: 'broadcast',
      event: 'transcript',
      payload: entry,
    }).catch(() => {})
  } catch {
    // Non-fatal — live viewing is best-effort
  }
}

export function cleanupBroadcastChannel(botId: string) {
  const key = `bot:${botId}:live`
  const ch = channelCache.get(key)
  if (ch) {
    ch.unsubscribe().catch(() => {})
    channelCache.delete(key)
  }
}
