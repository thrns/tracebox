'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

export function SignupForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-tracebox-bg px-4">
        <div className="w-full max-w-sm bg-tracebox-dark rounded-2xl border border-tracebox-border p-8 text-center space-y-4 shadow-2xl">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
          <div>
            <h2 className="text-lg font-semibold text-white">Check your email</h2>
            <p className="text-white/50 text-sm mt-2">
              We sent a confirmation link to <span className="text-white/80 font-medium">{email}</span>
            </p>
          </div>
          <Link
            href="/login"
            className="block w-full border border-tracebox-border text-white/70 hover:text-white hover:border-white/30 py-2.5 rounded-lg text-sm transition-colors text-center"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-tracebox-bg px-4">
      <div className="flex flex-col items-center gap-3 mb-8">
        <Image src="/tracebox-logo.png" alt="tracebox" width={56} height={56} className="w-14 h-14 object-contain" />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">tracebox</h1>
          <p className="text-tracebox-muted text-sm mt-0.5">Intelligence, picked at its peak.</p>
        </div>
      </div>

      <div className="w-full max-w-sm bg-tracebox-dark rounded-2xl border border-tracebox-border p-7 shadow-2xl">
        <h2 className="text-base font-semibold text-white mb-5">Create your account</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm text-white/70 font-medium" htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-[#111111] border border-tracebox-border rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-tracebox-primary/60 focus:ring-1 focus:ring-tracebox-primary/30 transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-white/70 font-medium" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-[#111111] border border-tracebox-border rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-tracebox-primary/60 focus:ring-1 focus:ring-tracebox-primary/30 transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-white/70 font-medium" htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
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
            className="w-full bg-tracebox-primary hover:bg-tracebox-primary-dark disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-tracebox-primary/20 mt-1"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</>
            ) : 'Create Account'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-white/40">
          Already have an account?{' '}
          <Link href="/login" className="text-tracebox-primary hover:text-tracebox-accent transition-colors font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
