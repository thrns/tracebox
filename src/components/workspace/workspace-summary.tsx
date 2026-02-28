'use client'

import type { Bot } from '@/types/bot'
import type { Workspace } from '@/types/workspace'
import { Download } from 'lucide-react'

interface WorkspaceSummaryProps {
  workspace: Workspace
  bots: Bot[]
}

export function WorkspaceSummary({ workspace, bots }: WorkspaceSummaryProps) {
  const completed = bots.filter((b) => b.status === 'complete').length
  const failed = bots.filter((b) => b.status === 'error').length
  const successRate = bots.length > 0 ? Math.round(((completed) / bots.length) * 100) : 0

  const completedBots = bots.filter((b) => b.status === 'complete' && b.session_duration_seconds)
  const avgDuration =
    completedBots.length > 0
      ? Math.round(completedBots.reduce((sum, b) => sum + (b.session_duration_seconds || 0), 0) / completedBots.length)
      : 0

  const avgMins = String(Math.floor(avgDuration / 60)).padStart(2, '0')
  const avgSecs = String(avgDuration % 60).padStart(2, '0')

  const exportTranscripts = (format: 'json' | 'csv') => {
    const allTranscripts = bots
      .filter((b) => b.transcript_json && b.transcript_json.length > 0)
      .map((b) => ({
        botId: b.id,
        botNumber: b.bot_number,
        status: b.status,
        duration: b.session_duration_seconds,
        transcript: b.transcript_json,
      }))

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(allTranscripts, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${workspace.name.replace(/\s+/g, '-')}-transcripts.json`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      const rows: string[] = ['bot_number,speaker,text,timestamp_ms']
      allTranscripts.forEach(({ botNumber, transcript }) => {
        transcript?.forEach((entry) => {
          rows.push(`${botNumber},${entry.speaker},"${entry.text.replace(/"/g, '""')}",${entry.timestampMs}`)
        })
      })
      const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${workspace.name.replace(/\s+/g, '-')}-transcripts.csv`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="border-t border-tracebox-border bg-tracebox-dark/90 px-6 py-4 flex items-center justify-between gap-8 flex-shrink-0">
      <div className="flex items-center gap-10">
        <div>
          <p className="text-[11px] text-white/40 uppercase tracking-wider mb-0.5">Total Bots</p>
          <p className="text-lg font-bold text-white tabular-nums">{workspace.bot_count}</p>
        </div>
        <div>
          <p className="text-[11px] text-white/40 uppercase tracking-wider mb-0.5">Success Rate</p>
          <p className="text-lg font-bold text-green-400 tabular-nums">{successRate}%</p>
        </div>
        <div>
          <p className="text-[11px] text-white/40 uppercase tracking-wider mb-0.5">Avg. Duration</p>
          <p className="text-lg font-bold text-white tabular-nums">{avgDuration > 0 ? `${avgMins}:${avgSecs}` : '--:--'}</p>
        </div>
        {failed > 0 && (
          <div>
            <p className="text-[11px] text-white/40 uppercase tracking-wider mb-0.5">Failed</p>
            <p className="text-lg font-bold text-red-400 tabular-nums">{failed}</p>
          </div>
        )}
      </div>

      <button
        onClick={() => exportTranscripts('json')}
        disabled={completed === 0}
        className="flex items-center gap-2 border border-tracebox-border hover:border-white/25 text-white/55 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        <Download className="w-4 h-4" />
        Export All Transcripts
      </button>
    </div>
  )
}
