'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DashboardStatsChart } from '@/components/workspace/dashboard-stats-chart'
import type { Workspace } from '@/types/workspace'
import { BarChart3 } from 'lucide-react'

interface WorkspaceWithBotStats extends Workspace {
  completedBots: number
  failedBots: number
}

export default function AnalyticsPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceWithBotStats[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchWorkspaces = async () => {
      const { data: workspacesData } = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: false })

      if (!workspacesData) {
        setLoading(false)
        return
      }

      const workspacesWithStats = await Promise.all(
        workspacesData.map(async (ws) => {
          const { data: bots } = await supabase
            .from('bots')
            .select('status')
            .eq('workspace_id', ws.id)

          const completedBots = bots?.filter((b: { status: string }) => b.status === 'complete').length || 0
          const failedBots = bots?.filter((b: { status: string }) => b.status === 'error').length || 0

          return { ...ws, completedBots, failedBots }
        })
      )

      setWorkspaces(workspacesWithStats)
      setLoading(false)
    }

    fetchWorkspaces()

    const channel = supabase
      .channel('analytics-workspaces')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspaces' }, () => {
        fetchWorkspaces()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <>
      <div className="h-14 border-b border-tracebox-border bg-tracebox-bg/80 flex items-center px-6 flex-shrink-0" />

      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white tracking-tight">Analytics</h1>
          <p className="text-sm text-white/45 mt-1.5">Overview of bot runs and success rates across workspaces.</p>
        </div>

        {loading ? (
          <div className="rounded-xl border border-tracebox-border bg-tracebox-dark/60 p-6 animate-pulse">
            <div className="h-4 bg-white/5 rounded w-1/4 mb-4" />
            <div className="h-[140px] bg-white/5 rounded" />
          </div>
        ) : workspaces.length === 0 ? (
          <div className="rounded-xl border border-tracebox-border bg-tracebox-dark/80 p-12 text-center">
            <BarChart3 className="w-10 h-10 text-white/15 mx-auto mb-3" />
            <p className="text-sm text-white/40">No workspace data yet. Create a workspace and run tests to see analytics.</p>
          </div>
        ) : (
          <>
            <DashboardStatsChart workspaces={workspaces} />
            {workspaces.reduce((sum, w) => sum + w.bot_count, 0) === 0 && (
              <div className="rounded-xl border border-tracebox-border bg-tracebox-dark p-6 mt-4 text-center">
                <p className="text-sm text-white/40">Run bots in a workspace to see run statistics here.</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="border-t border-tracebox-border bg-tracebox-bg/50 px-6 py-3 text-center flex-shrink-0">
        <p className="text-[11px] text-white/20 uppercase tracking-widest">
          © 2026 tracebox Infrastructure Labs. All Systems Operational.
        </p>
      </div>
    </>
  )
}
