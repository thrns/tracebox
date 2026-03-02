'use client'

import { useState } from 'react'
import { X, Download, AlertCircle, Cpu, MessageSquare, Video, Camera, ChevronLeft, ChevronRight, ExternalLink, Terminal } from 'lucide-react'
import type { Bot } from '@/types/bot'

interface BotDetailPanelProps {
  bot: Bot | null
  open: boolean
  onClose: () => void
}

const NODE_META: Record<string, { desc: string; color: string }> = {
  navigate:   { desc: 'Navigating browser to target URL.',              color: 'bg-blue-400' },
  listen:     { desc: 'Listening for system audio response.',           color: 'bg-green-400' },
  transcribe: { desc: 'Transcribing captured audio to text.',           color: 'bg-purple-400' },
  reason:     { desc: 'LLM deciding next action.',                      color: 'bg-yellow-400' },
  act:        { desc: 'Executing browser action / screenshot.',         color: 'bg-pink-400' },
  speak:      { desc: 'Generating and injecting TTS audio.',            color: 'bg-tracebox-primary' },
  finalize:   { desc: 'Uploading recording and finalising session.',    color: 'bg-orange-400' },
}

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

type RightTab = 'transcript' | 'logs'

export function BotDetailPanel({ bot, open, onClose }: BotDetailPanelProps) {
  const [screenshotIdx, setScreenshotIdx] = useState(0)
  const [rightTab, setRightTab] = useState<RightTab>('transcript')

  if (!bot || !open) return null

  const sessionId = `BB-${bot.id.slice(0, 6).toUpperCase()}-X`
  const isSuccess = bot.status === 'complete'
  const isError = bot.status === 'error'
  const duration = bot.session_duration_seconds
    ? `${String(Math.floor(bot.session_duration_seconds / 60)).padStart(2, '0')}:${String(bot.session_duration_seconds % 60).padStart(2, '0')}.0`
    : '--:--'

  const screenshots = bot.screenshot_urls?.filter(Boolean) ?? []

  const downloadTranscript = () => {
    if (!bot.transcript_json) return
    const blob = new Blob([JSON.stringify(bot.transcript_json, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bot-${bot.bot_number}-transcript.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Only include numeric timing entries — exclude any non-timing keys (e.g. legacy screenshotUrls array)
  const traceNodes = bot.langgraph_trace
    ? Object.entries(bot.langgraph_trace)
        .filter(([, val]) => typeof val === 'number')
        .map(([key, val]) => {
          const ms = val as number
          const meta = NODE_META[key] ?? { desc: key, color: 'bg-tracebox-primary' }
          return { label: key.toUpperCase(), desc: meta.desc, color: meta.color, latencyMs: ms }
        })
    : null

  const totalLatencyMs = traceNodes?.length
    ? traceNodes.reduce((sum, n) => sum + n.latencyMs, 0)
    : null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-3xl bg-tracebox-bg border-l border-tracebox-border z-50 flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-tracebox-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-white/50">SESSION_ID:</span>
                <span className="text-xs font-mono font-bold text-white">{sessionId}</span>
                {isSuccess && (
                  <span className="text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded">
                    SUCCESS
                  </span>
                )}
                {isError && (
                  <span className="text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded">
                    ERROR
                  </span>
                )}
              </div>
              <p className="text-xs text-white/30 mt-0.5">
                AGENT: tracebox-V4.2 • LANGCHAIN RUNTIME 0.1.2
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={downloadTranscript}
              disabled={!bot.transcript_json}
              className="flex items-center gap-1.5 bg-tracebox-primary hover:bg-tracebox-primary-dark disabled:opacity-40 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              EXPORT JSON
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg border border-tracebox-border flex items-center justify-center text-white/40 hover:text-white hover:border-white/30 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body — fixed height, each column scrolls independently */}
        <div className="flex-1 min-h-0 flex">
          <div className="grid grid-cols-2 gap-0 w-full">
            {/* Left: Recording + Trace (independently scrollable) */}
            <div className="border-r border-tracebox-border overflow-y-auto">
              {/* Recording */}
              <div className="p-4 border-b border-tracebox-border">
                <p className="text-xs text-white/40 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5" />
                  Visual Playback (.webm)
                </p>
                {bot.recording_url ? (
                  <video
                    src={bot.recording_url}
                    controls
                    className="w-full rounded-lg border border-tracebox-border bg-black aspect-video"
                  />
                ) : (
                  <div className="w-full aspect-video bg-[#111111] rounded-lg border border-tracebox-border flex items-center justify-center">
                    <p className="text-white/20 text-sm">Session Recording</p>
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="bg-tracebox-dark border border-tracebox-border rounded-lg p-3">
                    <p className="text-xs text-white/40 uppercase tracking-wider">Duration</p>
                    <p className="text-base font-mono font-bold text-white mt-1">{duration}</p>
                  </div>
                  <div className="bg-tracebox-dark border border-tracebox-border rounded-lg p-3">
                    <p className="text-xs text-white/40 uppercase tracking-wider">Tokens Used</p>
                    <p className="text-base font-mono font-bold text-white mt-1">
                      {bot.transcript_json ? bot.transcript_json.length * 120 : '—'}
                    </p>
                  </div>
                  <div className="bg-tracebox-dark border border-tracebox-border rounded-lg p-3">
                    <p className="text-xs text-white/40 uppercase tracking-wider">API Calls</p>
                    <p className="text-base font-mono font-bold text-white mt-1">
                      {bot.transcript_json ? `${bot.transcript_json.length} Tool Execs` : '—'}
                    </p>
                  </div>
                  <div className="bg-tracebox-dark border border-tracebox-border rounded-lg p-3">
                    <p className="text-xs text-white/40 uppercase tracking-wider">Cost (Est.)</p>
                    <p className="text-base font-mono font-bold text-white mt-1">
                      {bot.transcript_json ? `$${((bot.transcript_json.length * 120) / 1000 * 0.03).toFixed(4)}` : '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Screenshots */}
              {screenshots.length > 0 && (
                <div className="p-4 border-b border-tracebox-border">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-white/40 uppercase tracking-wider flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5" />
                      Screenshots
                    </p>
                    <span className="text-xs text-white/30">{screenshotIdx + 1} / {screenshots.length}</span>
                  </div>

                  <div className="relative">
                    <img
                      src={screenshots[screenshotIdx]}
                      alt={`Screenshot ${screenshotIdx + 1}`}
                      className="w-full rounded-lg border border-tracebox-border bg-[#111111] object-contain max-h-48"
                    />
                    {screenshots.length > 1 && (
                      <>
                        <button
                          onClick={() => setScreenshotIdx((i) => Math.max(0, i - 1))}
                          disabled={screenshotIdx === 0}
                          className="absolute left-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-white/60 hover:text-white disabled:opacity-30 transition-colors"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setScreenshotIdx((i) => Math.min(screenshots.length - 1, i + 1))}
                          disabled={screenshotIdx === screenshots.length - 1}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-white/60 hover:text-white disabled:opacity-30 transition-colors"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    <a
                      href={screenshots[screenshotIdx]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {/* Thumbnail strip */}
                  {screenshots.length > 1 && (
                    <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1">
                      {screenshots.map((url, i) => (
                        <button
                          key={i}
                          onClick={() => setScreenshotIdx(i)}
                          className={`flex-shrink-0 w-12 h-9 rounded border overflow-hidden transition-colors ${i === screenshotIdx ? 'border-tracebox-primary' : 'border-tracebox-border hover:border-white/30'}`}
                        >
                          <img src={url} alt={`thumb ${i + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Execution Trace */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-white/40 uppercase tracking-wider flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" />
                    Execution Trace (LangGraph)
                  </p>
                  <span className="text-xs text-white/30">
                    {totalLatencyMs !== null
                      ? `Total Latency: ${formatLatency(totalLatencyMs)}`
                      : 'Awaiting trace data…'}
                  </span>
                </div>
                <div className="space-y-2">
                  {traceNodes ? traceNodes.map((node, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-1">
                        <div className={`w-2 h-2 rounded-full ${node.color}`} />
                        {i < traceNodes.length - 1 && <div className="w-px h-6 bg-tracebox-border" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-white">{node.label}</span>
                          <span className="text-xs text-white/30 font-mono">{formatLatency(node.latencyMs)}</span>
                        </div>
                        <p className="text-xs text-white/40 mt-0.5 truncate">{node.desc}</p>
                      </div>
                    </div>
                  )) : (
                    <p className="text-xs text-white/20 italic">No trace recorded for this session.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Transcript / Logs with tab toggle */}
            <div className="flex flex-col min-h-0">
              {/* Tab bar */}
              <div className="flex items-center border-b border-tracebox-border flex-shrink-0">
                <button
                  onClick={() => setRightTab('transcript')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${rightTab === 'transcript' ? 'text-white border-b-2 border-tracebox-primary' : 'text-white/40 hover:text-white/60'}`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Transcript
                </button>
                <button
                  onClick={() => setRightTab('logs')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${rightTab === 'logs' ? 'text-white border-b-2 border-tracebox-primary' : 'text-white/40 hover:text-white/60'}`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  Server Logs
                </button>
              </div>

              {/* Scrollable content area */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {rightTab === 'transcript' ? (
                  <div className="p-4 space-y-3">
                    {bot.status === 'error' && bot.error_message && (
                      <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-400">{bot.error_message}</p>
                      </div>
                    )}

                    {bot.transcript_json && bot.transcript_json.length > 0 ? (
                      bot.transcript_json.map((entry, i) => {
                        const timeStr = `[${String(Math.floor(entry.timestampMs / 60000)).padStart(2, '0')}:${String(Math.floor((entry.timestampMs % 60000) / 1000)).padStart(2, '0')}:${String(Math.floor(entry.timestampMs % 1000 / 10)).padStart(2, '0')}]`
                        return (
                          <div key={i} className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-white/25">{timeStr}</span>
                              <span className={`text-xs font-bold uppercase ${entry.speaker === 'bot' ? 'text-tracebox-primary' : 'text-blue-400'}`}>
                                {entry.speaker === 'bot' ? 'BOT' : 'SYSTEM'}
                              </span>
                            </div>
                            <p className="text-sm text-white/80 leading-relaxed pl-1">{entry.text}</p>
                          </div>
                        )
                      })
                    ) : (
                      <div className="flex flex-col items-center justify-center h-40 text-white/20">
                        <MessageSquare className="w-8 h-8 mb-2" />
                        <p className="text-xs">No transcript available</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 space-y-1 font-mono text-xs">
                    {bot.server_logs && bot.server_logs.length > 0 ? (
                      bot.server_logs.map((entry, i) => {
                        const d = new Date(entry.timestamp)
                        const ts = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`
                        const levelColor = entry.level === 'error' ? 'text-red-400' : entry.level === 'warn' ? 'text-yellow-400' : 'text-white/50'
                        const nodeColor = NODE_META[entry.node]?.color?.replace('bg-', 'text-') ?? 'text-white/40'
                        return (
                          <div key={i} className="flex gap-2 leading-relaxed hover:bg-white/[0.02] px-1 -mx-1 rounded">
                            <span className="text-white/20 flex-shrink-0">{ts}</span>
                            <span className={`flex-shrink-0 w-20 text-right ${nodeColor}`}>{entry.node}</span>
                            <span className={levelColor}>{entry.message}</span>
                          </div>
                        )
                      })
                    ) : (
                      <div className="flex flex-col items-center justify-center h-40 text-white/20">
                        <Terminal className="w-8 h-8 mb-2" />
                        <p className="text-xs">No server logs available</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-tracebox-border px-6 py-2.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-white/30 font-mono">WORKER_ID: NODE-WEST-64</span>
            <span className="text-xs text-green-400 font-mono">• LIVE CONNECTION</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="text-xs text-white/30 hover:text-white/60 transition-colors">VIEW SOURCE LOG</button>
            <span className="text-xs text-white/20 font-mono">VERSION: tracebox-ALPHA-2.4</span>
          </div>
        </div>
      </div>
    </>
  )
}
