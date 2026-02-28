'use client'

import { useEffect, useState, useRef } from 'react'
import { X, Save, Loader2, FileText, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface InstructionsEditorModalProps {
  open: boolean
  workspaceId: string
  initialInstructions: string
  onClose: () => void
  onSaved: (updated: string) => void
}

export function InstructionsEditorModal({
  open,
  workspaceId,
  initialInstructions,
  onClose,
  onSaved,
}: InstructionsEditorModalProps) {
  const [content, setContent] = useState(initialInstructions)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const supabase = createClient()

  // Sync content whenever the modal is opened (picks up latest value)
  useEffect(() => {
    if (open) {
      setContent(initialInstructions)
      setError(null)
      setSaved(false)
    }
  }, [open, initialInstructions])

  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [open])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)

    const { error } = await supabase
      .from('workspaces')
      .update({ instructions: content, updated_at: new Date().toISOString() })
      .eq('id', workspaceId)

    if (error) {
      setError(error.message)
    } else {
      setSaved(true)
      onSaved(content)
      setTimeout(() => setSaved(false), 2500)
    }
    setSaving(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Escape') onClose()
  }

  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      <div
        className="fixed inset-x-0 top-1/2 -translate-y-1/2 mx-auto w-full max-w-3xl z-50 flex flex-col bg-tracebox-bg border border-tracebox-border rounded-xl shadow-2xl overflow-hidden"
        style={{ maxHeight: '80vh' }}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-tracebox-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-tracebox-primary" />
            <span className="text-sm font-semibold text-white">Edit Instructions</span>
          </div>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="text-xs text-green-400 font-semibold">Saved!</span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 bg-tracebox-primary hover:bg-tracebox-primary-dark disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Save
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg border border-tracebox-border flex items-center justify-center text-white/40 hover:text-white hover:border-white/30 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden min-h-0">
          {error ? (
            <div className="flex items-start gap-2 m-5 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-full min-h-[400px] bg-tracebox-dark text-white/90 text-sm font-mono leading-relaxed p-5 resize-none outline-none border-0 placeholder-white/20"
              placeholder="Write your bot instructions in Markdown…"
              spellCheck={false}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2 border-t border-tracebox-border flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-white/25">Markdown supported · ⌘S to save · Esc to close</span>
          <span className="text-xs text-white/25 font-mono">{content.length} chars</span>
        </div>
      </div>
    </>
  )
}
