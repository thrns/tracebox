'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Radio, MessageSquare } from 'lucide-react'
import type { TranscriptEntry } from '@/types/bot'

interface LiveViewerProps {
  botId: string
  botNumber: number
  onClose: () => void
}

export function LiveViewer({ botId, botNumber, onClose }: LiveViewerProps) {
  const [frameSrc, setFrameSrc] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [connected, setConnected] = useState(false)
  const [ended, setEnded] = useState(false)
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [transcript, scrollToBottom])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`bot:${botId}:live`)

    channel
      .on('broadcast', { event: 'frame' }, (msg) => {
        const base64 = msg.payload?.data as string | undefined
        if (base64) {
          setFrameSrc(`data:image/jpeg;base64,${base64}`)
        }
      })
      .on('broadcast', { event: 'transcript' }, (msg) => {
        const entry = msg.payload as TranscriptEntry | undefined
        if (entry?.text) {
          setTranscript((prev) => [...prev, entry])
        }
      })
      .on('broadcast', { event: 'ended' }, () => {
        setEnded(true)
      })
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [botId])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-4 md:inset-12 lg:inset-20 bg-tracebox-bg border border-tracebox-border rounded-2xl z-50 flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-tracebox-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Radio className={`w-4 h-4 ${ended ? 'text-red-400' : 'text-red-500 animate-pulse'}`} />
              <span className="text-sm font-bold text-white">
                {ended ? 'Session Ended' : 'LIVE'} — Bot #{botNumber}
              </span>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded font-mono ${connected ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>
              {connected ? 'CONNECTED' : 'CONNECTING...'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg border border-tracebox-border flex items-center justify-center text-white/40 hover:text-white hover:border-white/30 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Screen feed */}
          <div className="flex-1 bg-black flex items-center justify-center p-2 min-w-0">
            {frameSrc ? (
              <img
                src={frameSrc}
                alt="Live screen"
                className="max-w-full max-h-full object-contain rounded"
              />
            ) : (
              <div className="text-white/20 text-sm flex flex-col items-center gap-2">
                <Radio className="w-8 h-8" />
                <p>{ended ? 'Stream ended' : 'Waiting for frames...'}</p>
              </div>
            )}
          </div>

          {/* Live transcript sidebar */}
          <div className="w-80 border-l border-tracebox-border flex flex-col flex-shrink-0">
            <div className="px-4 py-3 border-b border-tracebox-border flex items-center gap-1.5 flex-shrink-0">
              <MessageSquare className="w-3.5 h-3.5 text-white/40" />
              <span className="text-xs text-white/40 uppercase tracking-wider font-semibold">Live Transcript</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {transcript.length === 0 && (
                <p className="text-xs text-white/20 italic text-center mt-8">
                  {ended ? 'No transcript entries received.' : 'Waiting for conversation...'}
                </p>
              )}
              {transcript.map((entry, i) => {
                const mins = String(Math.floor(entry.timestampMs / 60000)).padStart(2, '0')
                const secs = String(Math.floor((entry.timestampMs % 60000) / 1000)).padStart(2, '0')
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-white/25">[{mins}:{secs}]</span>
                      <span className={`text-xs font-bold uppercase ${entry.speaker === 'bot' ? 'text-tracebox-primary' : 'text-blue-400'}`}>
                        {entry.speaker === 'bot' ? 'BOT' : 'TUTOR'}
                      </span>
                    </div>
                    <p className="text-sm text-white/80 leading-relaxed pl-1">{entry.text}</p>
                  </div>
                )
              })}
              <div ref={transcriptEndRef} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-tracebox-border px-5 py-2 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${ended ? 'bg-red-400' : 'bg-red-500 animate-pulse'}`} />
            <span className="text-xs text-white/30 font-mono">
              {ended ? 'STREAM ENDED' : 'LIVE BROADCAST'} • ~1 FPS
            </span>
          </div>
          <span className="text-xs text-white/20 font-mono">
            {transcript.length} transcript entries
          </span>
        </div>
      </div>
    </>
  )
}
