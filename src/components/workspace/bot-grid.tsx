'use client'

import { useState } from 'react'
import { BotCard } from './bot-card'
import { BotDetailPanel } from './bot-detail-panel'
import { LiveViewer } from './live-viewer'
import type { Bot } from '@/types/bot'
import { Plus } from 'lucide-react'

interface BotGridProps {
  bots: Bot[]
  loading?: boolean
  onQueueNew?: () => void
}

export function BotGrid({ bots, loading, onQueueNew }: BotGridProps) {
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null)
  const [liveBot, setLiveBot] = useState<Bot | null>(null)

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-tracebox-dark/60 border border-tracebox-border rounded-xl p-5 animate-pulse">
            <div className="h-3 bg-white/5 rounded w-1/2 mb-4" />
            <div className="h-9 bg-white/5 rounded mb-4" />
            <div className="h-2 bg-white/5 rounded w-full" />
          </div>
        ))}
      </div>
    )
  }

  if (bots.length === 0) {
    return (
      <div className="text-center py-20 text-white/40">
        <p className="text-sm font-medium">No bots yet</p>
        <p className="text-xs mt-1 text-white/30">Run the test to spawn bots.</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {bots.map((bot) => (
          <BotCard
            key={bot.id}
            bot={bot}
            onClick={() => setSelectedBot(bot)}
            onWatchLive={() => setLiveBot(bot)}
          />
        ))}

        {/* Queue New Bot card */}
        {onQueueNew && (
          <div
            className="border border-dashed border-tracebox-border rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-white/15 hover:bg-tracebox-dark/30 transition-colors text-white/25 hover:text-white/50 min-h-[120px]"
            onClick={onQueueNew}
          >
            <Plus className="w-6 h-6" />
            <span className="text-xs font-medium">Queue New Bot</span>
          </div>
        )}
      </div>

      <BotDetailPanel
        bot={selectedBot}
        open={!!selectedBot}
        onClose={() => setSelectedBot(null)}
      />

      {liveBot && (
        <LiveViewer
          botId={liveBot.id}
          botNumber={liveBot.bot_number}
          onClose={() => setLiveBot(null)}
        />
      )}
    </>
  )
}
