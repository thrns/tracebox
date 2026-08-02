'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Upload, X, FileText, PenLine } from 'lucide-react'

export function WorkspaceConfigForm() {
  const [name, setName] = useState('')
  const [targetUrl, setTargetUrl] = useState('')
  const [botCount, setBotCount] = useState(10)
  const [maxDuration, setMaxDuration] = useState(3600)
  const [llmProvider, setLlmProvider] = useState<'openai' | 'gemini'>('openai')
  const [instructionsFile, setInstructionsFile] = useState<File | null>(null)
  const [instructionsText, setInstructionsText] = useState('')
  const [instructionsMode, setInstructionsMode] = useState<'write' | 'upload'>('write')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setInstructionsFile(file)
      const reader = new FileReader()
      reader.onload = (ev) => setInstructionsText(ev.target?.result as string)
      reader.readAsText(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && (file.name.endsWith('.md') || file.name.endsWith('.txt'))) {
      setInstructionsFile(file)
      const reader = new FileReader()
      reader.onload = (ev) => setInstructionsText(ev.target?.result as string)
      reader.readAsText(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (instructionsMode === 'write' && !instructionsText.trim()) {
      setError('Please write or paste your bot instructions')
      return
    }
    if (instructionsMode === 'upload' && !instructionsFile) {
      setError('Please upload an instructions file')
      return
    }

    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Read file content into a string if uploaded, otherwise use the textarea text
      const instructions = instructionsFile
        ? await instructionsFile.text()
        : instructionsText

      const { data: workspace, error: insertError } = await supabase
        .from('workspaces')
        .insert({
          name,
          target_url: targetUrl,
          bot_count: botCount,
          max_session_duration: maxDuration,
          llm_provider: llmProvider,
          instructions,
          user_id: user.id,
          status: 'draft',
        })
        .select()
        .single()

      if (insertError) throw new Error(insertError.message)

      router.push(`/workspace/${workspace.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  const inputClass =
    'w-full bg-[#111111] border border-tracebox-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-tracebox-primary/50 focus:ring-1 focus:ring-tracebox-primary/20 transition-colors'
  const labelClass = 'text-xs font-medium text-white/60'

  return (
    <div className="min-h-screen h-full w-full bg-tracebox-bg flex items-start justify-start p-4">
      <div className="w-full bg-tracebox-dark border border-tracebox-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
       

        {/* Form: left = config, right = instructions */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-0 flex-1 min-h-0">
            {/* Left — all config fields */}
            <div className="p-6 border-r border-tracebox-border space-y-4 overflow-y-auto flex-shrink-0">
              <div className="space-y-1.5">
                <label className={labelClass}>
                  Workspace Name <span className="text-tracebox-primary">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Production Load Test"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label className={`${labelClass} flex items-center gap-1`}>
                  Target URL
                  <span className="w-3.5 h-3.5 rounded-full border border-white/20 text-white/30 text-[9px] flex items-center justify-center" title="URL the bots will navigate to">i</span>
                </label>
                <input
                  type="url"
                  placeholder="https://app.example.com"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Number of Bots</label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={botCount}
                    onChange={(e) => setBotCount(parseInt(e.target.value) || 1)}
                    required
                    className={`${inputClass} pr-14`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/25">1-100</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Max Session Duration</label>
                <div className="relative">
                  <input
                    type="number"
                    min={30}
                    max={7200}
                    value={maxDuration}
                    onChange={(e) => setMaxDuration(parseInt(e.target.value) || 3600)}
                    required
                    className={`${inputClass} pr-12`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/25">secs</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>LLM Provider</label>
                <select
                  value={llmProvider}
                  onChange={(e) => setLlmProvider(e.target.value as 'openai' | 'gemini')}
                  className={`${inputClass} appearance-none cursor-pointer`}
                >
                  <option value="openai">OpenAI (GPT-4o)</option>
                  <option value="gemini">Google Gemini</option>
                </select>
              </div>
            </div>

            {/* Right — entire area for bot instructions */}
            <div className="flex flex-col min-h-0 p-6">
              <div className="flex items-center justify-between gap-3 mb-3 flex-shrink-0">
                <label className={`${labelClass}`}>Bot Instructions</label>
                <div className="flex items-center gap-0.5 bg-[#111111] border border-tracebox-border rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setInstructionsMode('write')}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      instructionsMode === 'write'
                        ? 'bg-tracebox-primary text-white'
                        : 'text-white/40 hover:text-white/70'
                    }`}
                  >
                    <PenLine className="w-3 h-3" />
                    Write
                  </button>
                  <button
                    type="button"
                    onClick={() => setInstructionsMode('upload')}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      instructionsMode === 'upload'
                        ? 'bg-tracebox-primary text-white'
                        : 'text-white/40 hover:text-white/70'
                    }`}
                  >
                    <Upload className="w-3 h-3" />
                    Upload
                  </button>
                </div>
              </div>

              {instructionsMode === 'write' ? (
                <textarea
                  value={instructionsText}
                  onChange={(e) => setInstructionsText(e.target.value)}
                  placeholder={`# Bot Instructions\n\nDescribe what the bot should do...\n\n## Goal\n- Navigate to the login page\n- Enter credentials\n- ...`}
                  className="flex-1 min-h-[280px] w-full bg-[#111111] border border-tracebox-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-tracebox-primary/50 focus:ring-1 focus:ring-tracebox-primary/20 transition-colors font-mono leading-relaxed resize-none"
                />
              ) : (
                <div
                  className={`flex-1 min-h-[280px] flex flex-col border-2 border-dashed rounded-xl transition-colors overflow-hidden ${
                    instructionsFile
                      ? 'border-tracebox-primary/40 bg-tracebox-primary/5'
                      : 'border-tracebox-border hover:border-white/20'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".md,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {instructionsFile ? (
                    <div className="flex items-center justify-center gap-2 p-6">
                      <div className="w-8 h-8 rounded-lg bg-tracebox-primary/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-tracebox-primary" />
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-sm text-white font-medium truncate">{instructionsFile.name}</p>
                        <p className="text-xs text-white/40">{Math.round(instructionsFile.size / 1024)}KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setInstructionsFile(null); setInstructionsText('') }}
                        className="ml-2 text-white/30 hover:text-white/60 flex-shrink-0"
                        aria-label="Remove file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                      <Upload className="w-8 h-8 text-white/20 mb-2 flex-shrink-0" />
                      <p className="text-sm text-white/50">Click to upload or drag and drop</p>
                      <p className="text-xs text-white/25 mt-1">Markdown or text files (.md, .txt)</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="px-6 pb-2 flex-shrink-0">
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
                {error}
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-tracebox-border flex-shrink-0">
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              disabled={loading}
              className="text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-tracebox-primary hover:bg-tracebox-primary-dark disabled:opacity-60 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors shadow-lg shadow-tracebox-primary/20"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
              ) : 'Run Test'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
