'use client'

import type { Bot } from '@/types/bot'
import { CheckCircle2, AlertCircle, Loader2, Clock, StopCircle, Radio } from 'lucide-react'

const statusConfig = {
  queued:      { label: 'QUEUED',       color: 'text-white/40',    bg: 'bg-white/5',        barColor: 'bg-white/10' },
  connecting:  { label: 'CONNECTING',   color: 'text-blue-400',    bg: 'bg-blue-500/10',    barColor: 'bg-blue-500' },
  running:     { label: 'RUNNING',      color: 'text-tracebox-primary',  bg: 'bg-tracebox-primary/10',  barColor: 'bg-tracebox-primary' },
  transcribing:{ label: 'TRANSCRIBING', color: 'text-yellow-400',  bg: 'bg-yellow-500/10',  barColor: 'bg-yellow-400' },
  uploading:   { label: 'UPLOADING',    color: 'text-purple-400',  bg: 'bg-purple-500/10',  barColor: 'bg-purple-400' },
  complete:    { label: 'COMPLETE',     color: 'text-green-400',   bg: 'bg-green-500/10',   barColor: 'bg-green-500' },
  error:       { label: 'ERROR',        color: 'text-red-400',     bg: 'bg-red-500/10',     barColor: 'bg-red-500' },
  stopped:     { label: 'STOPPED',      color: 'text-orange-400',  bg: 'bg-orange-500/10',  barColor: 'bg-orange-500' },
}

// Mini waveform bars for visual effect
function WaveformBars({ color, animated }: { color: string; animated: boolean }) {
  const heights = [40, 70, 55, 90, 65, 80, 45, 75, 60, 85, 50, 70, 40, 60, 75]
  return (
    <div className="flex items-end gap-0.5 h-8">
      {heights.map((h, i) => (
        <div
          key={i}
          className={`w-1 rounded-sm ${color} ${animated ? 'animate-pulse-slow' : 'opacity-60'}`}
          style={{
            height: `${h}%`,
            animationDelay: `${i * 100}ms`,
          }}
        />
      ))}
    </div>
  )
}

function ElapsedTime({ bot }: { bot: Bot }) {
  if (bot.session_duration_seconds) {
    const mins = String(Math.floor(bot.session_duration_seconds / 60)).padStart(2, '0')
    const secs = String(bot.session_duration_seconds % 60).padStart(2, '0')
    return <span>{mins}:{secs}</span>
  }
  if (bot.started_at && !bot.completed_at) {
    const elapsed = Math.floor((Date.now() - new Date(bot.started_at).getTime()) / 1000)
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0')
    const secs = String(elapsed % 60).padStart(2, '0')
    return <span>{mins}:{secs}</span>
  }
  return <span>--:--</span>
}

interface BotCardProps {
  bot: Bot
  onClick: () => void
  onWatchLive?: () => void
}

export function BotCard({ bot, onClick, onWatchLive }: BotCardProps) {
  const config = statusConfig[bot.status]
  const isActive = ['running', 'transcribing', 'uploading', 'connecting'].includes(bot.status)
  const isComplete = bot.status === 'complete'
  const isError = bot.status === 'error'
  const isStopped = bot.status === 'stopped'

  return (
    <div
      className="bg-tracebox-dark border border-tracebox-border rounded-xl p-4 cursor-pointer hover:border-white/20 transition-all duration-200 group"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-white">Bot #{bot.bot_number}</p>
          <span className={`text-xs font-semibold ${config.color}`}>{config.label}</span>
        </div>
        {isComplete && <CheckCircle2 className="w-5 h-5 text-green-400" />}
        {isError && <AlertCircle className="w-5 h-5 text-red-400" />}
        {isStopped && <StopCircle className="w-5 h-5 text-orange-400" />}
        {isActive && <Loader2 className="w-4 h-4 text-tracebox-primary animate-spin" />}
      </div>

      {/* Waveform */}
      <div className="mb-3">
        <WaveformBars color={config.barColor} animated={isActive} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-white/40 flex items-center gap-1">
          {isComplete ? (
            <>
              <span className="text-white/30">Final Duration</span>
            </>
          ) : (
            <>
              <Clock className="w-3 h-3" />
              <span>Elapsed Time</span>
            </>
          )}
        </div>
        <span className="text-xs font-mono font-semibold text-white/70">
          <ElapsedTime bot={bot} />
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-0.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${config.barColor} ${isActive ? 'animate-pulse' : ''}`}
          style={{
            width: isComplete ? '100%' : isError ? '100%' : isStopped ? '50%' : isActive ? '60%' : '0%',
          }}
        />
      </div>

      {/* Watch Live button — only for active bots */}
      {isActive && onWatchLive && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onWatchLive()
          }}
          className="mt-3 w-full flex items-center justify-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 text-red-400 text-xs font-semibold py-1.5 rounded-lg transition-colors"
        >
          <Radio className="w-3 h-3 animate-pulse" />
          Watch Live
        </button>
      )}
    </div>
  )
}
