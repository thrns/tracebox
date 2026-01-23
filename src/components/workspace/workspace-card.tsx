'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Workspace } from '@/types/workspace'
import { formatDistanceToNow } from 'date-fns'
import { Calendar, Bot, MoreVertical, ExternalLink, Trash2, Pencil } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const statusConfig = {
  draft: { label: 'DRAFT', bg: 'bg-white/10', text: 'text-white/60', dot: 'bg-white/40' },
  running: { label: 'RUNNING', bg: 'bg-tracebox-primary/10', text: 'text-tracebox-primary', dot: 'bg-tracebox-primary animate-pulse' },
  completed: { label: 'COMPLETED', bg: 'bg-green-500/10', text: 'text-green-400', dot: 'bg-green-400' },
  failed: { label: 'FAILED', bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' },
  stopped: { label: 'STOPPED', bg: 'bg-orange-500/10', text: 'text-orange-400', dot: 'bg-orange-400' },
}

const progressBarColor = {
  draft: 'bg-white/20',
  running: 'bg-tracebox-primary',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  stopped: 'bg-orange-500',
}

interface WorkspaceCardProps {
  workspace: Workspace
  completedBots?: number
  failedBots?: number
  onDelete?: (workspaceId: string) => void
  onRename?: (workspaceId: string, newName: string) => void
}

export function WorkspaceCard({ workspace, completedBots = 0, failedBots = 0, onDelete, onRename }: WorkspaceCardProps) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameName, setRenameName] = useState(workspace.name)
  const [renaming, setRenaming] = useState(false)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const config = statusConfig[workspace.status]
  const progress = workspace.bot_count > 0 ? (completedBots / workspace.bot_count) * 100 : 0
  const barColor = progressBarColor[workspace.status]

  const handleRenameConfirm = async () => {
    const trimmed = renameName.trim()
    if (!trimmed || trimmed === workspace.name) { setRenameOpen(false); return }
    setRenaming(true)
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (res.ok) {
        onRename?.(workspace.id, trimmed)
        setRenameOpen(false)
      }
    } finally {
      setRenaming(false)
    }
  }

  const handleDeleteConfirm = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete workspace')
      }
      onDelete?.(workspace.id)
      setDeleteOpen(false)
    } catch (err) {
      console.error(err)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div
        className="bg-tracebox-dark/80 border border-tracebox-border rounded-xl p-5 cursor-pointer hover:border-white/15 hover:bg-tracebox-dark transition-all duration-200 group relative"
        onClick={() => router.push(`/workspace/${workspace.id}`)}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-semibold text-white text-[15px] leading-snug group-hover:text-white/95 line-clamp-2 min-w-0">
            {workspace.name}
          </h3>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
              {config.label}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none"
                aria-label="Workspace options"
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
              >
                <MoreVertical className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/workspace/${workspace.id}`) }}>
                  <ExternalLink className="w-4 h-4" />
                  Open
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenameName(workspace.name); setRenameOpen(true); setTimeout(() => renameInputRef.current?.select(), 50) }}>
                  <Pencil className="w-4 h-4" />
                  Rename
                </DropdownMenuItem>
                {onDelete && (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={(e) => { e.stopPropagation(); setDeleteOpen(true) }}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

      {/* Meta */}
      <div className="flex items-center gap-4 text-xs text-white/40 mb-4">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3 h-3" />
          <span>{formatDistanceToNow(new Date(workspace.created_at), { addSuffix: false })}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Bot className="w-3 h-3" />
          <span>{workspace.bot_count} bots</span>
        </div>
      </div>

      {/* Progress */}
      {workspace.status !== 'draft' && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Progress</span>
            <span className={`font-medium ${config.text}`}>
              {completedBots}/{workspace.bot_count} bots done
            </span>
          </div>
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          {failedBots > 0 && (
            <p className="text-xs text-red-400">Error encountered at bot {completedBots + 1}</p>
          )}
        </div>
      )}

      {workspace.status === 'draft' && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/30">Status</span>
          <span className="text-white/40">Ready to start</span>
        </div>
      )}
    </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Rename workspace</DialogTitle>
            <DialogDescription>Enter a new name for this workspace.</DialogDescription>
          </DialogHeader>
          <Input
            ref={renameInputRef}
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRenameConfirm(); if (e.key === 'Escape') setRenameOpen(false) }}
            disabled={renaming}
            placeholder="Workspace name"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)} disabled={renaming}>Cancel</Button>
            <Button onClick={handleRenameConfirm} disabled={renaming || !renameName.trim()}>
              {renaming ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Delete workspace</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{workspace.name}&quot;? This will remove the workspace and all its bot runs. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
