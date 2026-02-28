'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRealtimeBots } from '@/hooks/use-realtime-bots'
import { BotGrid } from '@/components/workspace/bot-grid'
import { WorkspaceSummary } from '@/components/workspace/workspace-summary'
import { InstructionsEditorModal } from '@/components/workspace/instructions-editor-modal'
import type { Workspace } from '@/types/workspace'
import { Play, Square, RefreshCw, Loader2, FileEdit, ChevronLeft, ChevronRight, Pencil, Check, X } from 'lucide-react'

const statusConfig = {
  draft: { label: 'Draft', dot: 'bg-white/40' },
  running: { label: 'Running', dot: 'bg-tracebox-primary animate-pulse' },
  completed: { label: 'Completed', dot: 'bg-green-400' },
  failed: { label: 'Failed', dot: 'bg-red-400' },
  stopped: { label: 'Stopped', dot: 'bg-orange-400' },
}

export default function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<'run' | 'stop' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingInstructions, setEditingInstructions] = useState(false)
  const [selectedRun, setSelectedRun] = useState<number | null>(null)
  const [renamingName, setRenamingName] = useState<string | null>(null)
  const [renameLoading, setRenameLoading] = useState(false)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const { runs, botsByRun, loading: botsLoading } = useRealtimeBots(id)
  const supabase = createClient()

  // Auto-select the latest run when runs change (e.g. new run starts)
  useEffect(() => {
    if (runs.length > 0) {
      setSelectedRun((prev) => {
        if (prev === null || !runs.includes(prev)) return runs[runs.length - 1]
        return prev
      })
    }
  }, [runs])

  const currentRunBots = selectedRun !== null ? (botsByRun.get(selectedRun) ?? []) : []
  const selectedRunIdx = selectedRun !== null ? runs.indexOf(selectedRun) : -1

  useEffect(() => {
    const fetchWorkspace = async () => {
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', id)
        .single()

      if (error) setError(error.message)
      else setWorkspace(data)
      setLoading(false)
    }

    fetchWorkspace()

    const channel = supabase
      .channel(`workspace:${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'workspaces', filter: `id=eq.${id}` }, (payload) => setWorkspace(payload.new as Workspace))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  const handleRun = async () => {
    setActionLoading('run')
    setError(null)
    try {
      const res = await fetch(`/api/workspaces/${id}/run`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to start')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start')
    }
    setActionLoading(null)
  }

  const handleStop = async () => {
    setActionLoading('stop')
    setError(null)
    try {
      const res = await fetch(`/api/workspaces/${id}/stop`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to stop')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop')
    }
    setActionLoading(null)
  }

  const startRename = () => {
    if (!workspace) return
    setRenamingName(workspace.name)
    setTimeout(() => renameInputRef.current?.select(), 0)
  }

  const commitRename = async () => {
    const trimmed = renamingName?.trim()
    if (!trimmed || trimmed === workspace?.name) { setRenamingName(null); return }
    setRenameLoading(true)
    try {
      const res = await fetch(`/api/workspaces/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (res.ok) {
        const updated = await res.json()
        setWorkspace(updated)
      }
    } finally {
      setRenameLoading(false)
      setRenamingName(null)
    }
  }

  const cancelRename = () => setRenamingName(null)

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-tracebox-primary animate-spin" />
      </div>
    )
  }

  if (!workspace) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/40 text-sm">Workspace not found</p>
          <button onClick={() => router.push('/dashboard')} className="mt-3 text-tracebox-primary text-sm hover:underline">
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const config = statusConfig[workspace.status]

  return (
    <>
      {/* Top bar */}
      <div className="h-14 border-b border-tracebox-border bg-tracebox-bg/80 flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {renamingName !== null ? (
            <div className="flex items-center gap-1.5">
              <input
                ref={renameInputRef}
                value={renamingName}
                onChange={(e) => setRenamingName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') cancelRename() }}
                onBlur={commitRename}
                disabled={renameLoading}
                className="text-base font-bold text-white bg-white/5 border border-tracebox-primary/50 rounded-md px-2 py-0.5 outline-none focus:border-tracebox-primary min-w-0 w-48"
                autoFocus
              />
              <button onClick={commitRename} disabled={renameLoading} className="text-green-400 hover:text-green-300 transition-colors">
                {renameLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              </button>
              <button onClick={cancelRename} className="text-white/40 hover:text-white/70 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group/rename min-w-0">
              <h1 className="text-base font-bold text-white truncate">{workspace.name}</h1>
              <button
                onClick={startRename}
                className="opacity-0 group-hover/rename:opacity-100 text-white/40 hover:text-white/70 transition-all flex-shrink-0"
                title="Rename workspace"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <span className="flex items-center gap-1.5 text-xs text-white/50 flex-shrink-0">
            <span className={`w-2 h-2 rounded-full ${config.dot}`} />
            {config.label}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setEditingInstructions(true)}
            className="flex items-center gap-2 border border-tracebox-border hover:border-white/25 text-white/55 hover:text-white text-sm font-medium px-3.5 py-2 rounded-lg transition-colors"
          >
            <FileEdit className="w-4 h-4" />
            Edit Instructions
          </button>

          {workspace.status === 'running' && (
            <button
              onClick={handleStop}
              disabled={actionLoading !== null}
              className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/15 border border-red-500/25 text-red-400 text-sm font-medium px-3.5 py-2 rounded-lg transition-colors disabled:opacity-60"
            >
              {actionLoading === 'stop' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
              Stop All Bots
            </button>
          )}

          {(workspace.status === 'draft' || workspace.status === 'completed' || workspace.status === 'failed' || workspace.status === 'stopped') && (
            <button
              onClick={handleRun}
              disabled={actionLoading !== null}
              className="flex items-center gap-2 bg-tracebox-primary hover:bg-tracebox-primary-dark text-white text-sm font-medium px-3.5 py-2 rounded-lg transition-colors shadow-md shadow-tracebox-primary/15 disabled:opacity-60"
            >
              {actionLoading === 'run' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : workspace.status === 'draft' ? (
                <Play className="w-4 h-4" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {workspace.status === 'draft' ? 'Run Test' : 'Re-run'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Run tabs */}
      {runs.length > 0 && (
        <div className="flex items-center gap-1 px-6 pt-4 pb-0 flex-shrink-0">
          <button
            onClick={() => selectedRunIdx > 0 && setSelectedRun(runs[selectedRunIdx - 1])}
            disabled={selectedRunIdx <= 0}
            className="w-7 h-7 rounded-lg border border-tracebox-border flex items-center justify-center text-white/40 hover:text-white hover:border-white/30 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1 overflow-x-auto">
            {runs.map((run) => {
              const isActive = run === selectedRun
              const runBots = botsByRun.get(run) ?? []
              const hasRunning = runBots.some((b) => ['running', 'connecting', 'transcribing', 'uploading'].includes(b.status))
              return (
                <button
                  key={run}
                  onClick={() => setSelectedRun(run)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex-shrink-0 ${
                    isActive
                      ? 'bg-tracebox-primary/15 text-tracebox-primary border border-tracebox-primary/30'
                      : 'text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  {hasRunning && <span className="w-1.5 h-1.5 rounded-full bg-tracebox-primary animate-pulse" />}
                  Run {run}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => selectedRunIdx < runs.length - 1 && setSelectedRun(runs[selectedRunIdx + 1])}
            disabled={selectedRunIdx >= runs.length - 1}
            className="w-7 h-7 rounded-lg border border-tracebox-border flex items-center justify-center text-white/40 hover:text-white hover:border-white/30 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bot Grid */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <BotGrid bots={currentRunBots} loading={botsLoading} onQueueNew={() => router.push('/workspace/new')} />
      </div>

      {/* Summary bar */}
      <WorkspaceSummary workspace={workspace} bots={currentRunBots} />

      <InstructionsEditorModal
        open={editingInstructions}
        workspaceId={workspace.id}
        initialInstructions={workspace.instructions}
        onClose={() => setEditingInstructions(false)}
        onSaved={(updated) => setWorkspace((w) => w ? { ...w, instructions: updated } : w)}
      />
    </>
  )
}
