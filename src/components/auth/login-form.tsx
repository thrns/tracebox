'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-tracebox-bg px-4">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <Image src="/tracebox-logo.png" alt="tracebox" width={56} height={56} className="w-14 h-14 object-contain" />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">tracebox</h1>
          <p className="text-tracebox-muted text-sm mt-0.5">Intelligence, picked at its peak.</p>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-tracebox-dark rounded-2xl border border-tracebox-border p-7 shadow-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm text-white/70 font-medium" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-[#111111] border border-tracebox-border rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-tracebox-primary/60 focus:ring-1 focus:ring-tracebox-primary/30 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm text-white/70 font-medium" htmlFor="password">
                Password
              </label>
              <button type="button" className="text-xs text-tracebox-primary hover:text-tracebox-accent transition-colors">
                Forgot password?
              </button>
            </div>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-[#111111] border border-tracebox-border rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-tracebox-primary/60 focus:ring-1 focus:ring-tracebox-primary/30 transition-colors"
            />
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-tracebox-primary hover:bg-tracebox-primary-dark disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-tracebox-primary/20"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

      </div>

      {/* Footer */}
      <div className="mt-8 flex items-center gap-2 text-xs text-white/20 uppercase tracking-widest">
        <span>Powered by</span>
        <span className="font-bold">⚡ Supabase</span>
      </div>
    </div>
  )
}
