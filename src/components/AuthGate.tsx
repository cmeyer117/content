import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

// Real Supabase Auth gate -- Content Manager was a fully public SPA before
// this (no passphrase, no login, nothing). Reuses the exact same owner
// account and coaching_is_owner() DB function that Row/Vessel already use
// -- same Supabase project, same owner, same pattern, just implemented as
// a React component instead of a vanilla script since this app is a Vite
// SPA, not static HTML.
const OWNER_EMAIL = 'carl.meyer.business@gmail.com'

function isOwner(session: Session | null): boolean {
  return !!session?.user?.email && session.user.email === OWNER_EMAIL
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [checked, setChecked] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session && !isOwner(data.session)) {
        await supabase.auth.signOut()
        if (!cancelled) { setSession(null); setChecked(true) }
        return
      }
      if (!cancelled) { setSession(data.session); setChecked(true) }
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(isOwner(newSession) ? newSession : null)
    })
    return () => { cancelled = true; sub.subscription.unsubscribe() }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (signInError || !data.session) {
      setError(signInError ? signInError.message : 'Sign-in failed')
      return
    }
    if (!isOwner(data.session)) {
      await supabase.auth.signOut()
      setError('This account is not authorized.')
      return
    }
    setSession(data.session)
  }

  if (!checked) return null

  if (!session) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <form onSubmit={handleSubmit} className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 flex flex-col gap-3">
          <h1 className="text-lg font-bold text-gray-900 mb-2">Content Manager &mdash; sign in</h1>
          <input
            type="email"
            placeholder="Email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="px-3 py-2 rounded border border-border bg-surface text-sm outline-none"
          />
          <input
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="px-3 py-2 rounded border border-border bg-surface text-sm outline-none"
          />
          {error && <div className="text-red-500 text-xs">{error}</div>}
          <button type="submit" className="px-3 py-2 rounded bg-accent text-white text-sm font-bold">
            Sign in
          </button>
        </form>
      </div>
    )
  }

  return <>{children}</>
}
