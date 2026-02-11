export interface LogEntry {
  timestamp: number
  node: string
  message: string
  level: 'info' | 'warn' | 'error'
}

const botLogs = new Map<string, LogEntry[]>()

export function botLog(
  botId: string,
  node: string,
  message: string,
  level: 'info' | 'warn' | 'error' = 'info'
) {
  if (!botLogs.has(botId)) botLogs.set(botId, [])
  const entry: LogEntry = { timestamp: Date.now(), node, message, level }
  botLogs.get(botId)!.push(entry)

  const prefix = level === 'error' ? 'ERROR: ' : level === 'warn' ? 'WARN: ' : ''
  console.log(`[${node}][${botId.slice(0, 8)}] ${prefix}${message}`)
}

export function getBotLogs(botId: string): LogEntry[] {
  return botLogs.get(botId) ?? []
}

export function clearBotLogs(botId: string) {
  botLogs.delete(botId)
}
