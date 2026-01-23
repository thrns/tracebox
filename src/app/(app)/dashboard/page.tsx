'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { WorkspaceCard } from '@/components/workspace/workspace-card'
import type { Workspace } from '@/types/workspace'
import { Plus, Bot } from 'lucide-react'

interface WorkspaceWithBotStats extends Workspace {
  completedBots: number
  failedBots: number
}

export default function DashboardPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceWithBotStats[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
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
      .channel('workspaces')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspaces' }, () => {
        fetchWorkspaces()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleDelete = (workspaceId: string) => {
    setWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId))
  }

  const handleRename = (workspaceId: string, newName: string) => {
    setWorkspaces((prev) => prev.map((w) => w.id === workspaceId ? { ...w, name: newName } : w))
  }

  return (
    <>
      {/* Top bar */}
      <div className="h-14 border-b border-tracebox-border bg-tracebox-bg/80 flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search workspaces, bots, or logs..."
              className="w-full bg-tracebox-dark/80 border border-tracebox-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-tracebox-primary/50 focus:ring-1 focus:ring-tracebox-primary/20 transition-colors"
            />
          </div>
        </div>

        <button
          onClick={() => router.push('/workspace/new')}
          className="flex items-center gap-2 bg-tracebox-primary hover:bg-tracebox-primary-dark text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors shadow-md shadow-tracebox-primary/15"
        >
          <Plus className="w-4 h-4" />
          New Test Workspace
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white tracking-tight">Workspaces</h1>
          <p className="text-sm text-white/45 mt-1.5">Manage and monitor your automated bot test suites.</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-tracebox-dark/60 border border-tracebox-border rounded-xl p-6 animate-pulse">
                <div className="h-4 bg-white/5 rounded w-3/4 mb-4" />
                <div className="h-3 bg-white/5 rounded w-1/2 mb-5" />
                <div className="h-1.5 bg-white/5 rounded w-full" />
              </div>
            ))}
          </div>
        ) : workspaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="w-20 h-20 rounded-2xl bg-tracebox-dark border border-tracebox-border flex items-center justify-center mb-5">
              <Bot className="w-10 h-10 text-white/15" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">No workspaces yet</h2>
            <p className="text-sm text-white/45 mb-8 max-w-sm">
              Create your first test workspace to start bulk testing voice agents.
            </p>
            <button
              onClick={() => router.push('/workspace/new')}
              className="flex items-center gap-2 bg-tracebox-primary hover:bg-tracebox-primary-dark text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors shadow-md shadow-tracebox-primary/15"
            >
              <Plus className="w-4 h-4" />
              Create Your First Workspace
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {workspaces.map((ws) => (
              <WorkspaceCard
                key={ws.id}
                workspace={ws}
                completedBots={ws.completedBots}
                failedBots={ws.failedBots}
                onDelete={handleDelete}
                onRename={handleRename}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-tracebox-border bg-tracebox-bg/50 px-6 py-3 text-center flex-shrink-0">
        <p className="text-[11px] text-white/20 uppercase tracking-widest">
          © 2026 tracebox Infrastructure Labs. All Systems Operational.
        </p>
      </div>
    </>
  )
}
