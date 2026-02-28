'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Bot } from '@/types/bot'

export function useRealtimeBots(workspaceId: string) {
  const [allBots, setAllBots] = useState<Bot[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('bots')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('run_number', { ascending: true })
      .order('bot_number', { ascending: true })
      .then(({ data }) => {
        setAllBots(data || [])
        setLoading(false)
      })

    const channel = supabase
      .channel(`bots:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bots',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          setAllBots((prev) => {
            const updated = [...prev]
            const incoming = payload.new as Bot
            const idx = updated.findIndex((b) => b.id === incoming.id)
            if (idx >= 0) updated[idx] = incoming
            else updated.push(incoming)
            return updated.sort((a, b) =>
              a.run_number !== b.run_number
                ? a.run_number - b.run_number
                : a.bot_number - b.bot_number
            )
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [workspaceId])

  const runs = useMemo(() => {
    const set = new Set(allBots.map((b) => b.run_number))
    return Array.from(set).sort((a, b) => a - b)
  }, [allBots])

  const botsByRun = useMemo(() => {
    const map = new Map<number, Bot[]>()
    for (const bot of allBots) {
      if (!map.has(bot.run_number)) map.set(bot.run_number, [])
      map.get(bot.run_number)!.push(bot)
    }
    return map
  }, [allBots])

  return { allBots, runs, botsByRun, loading }
}
