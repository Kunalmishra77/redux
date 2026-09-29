import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'
import { db, kvGet, kvSet } from './db'
import { roleFromToken, supabase } from './supabase'

type AuthCtx = {
  session: Session | null
  ready: boolean
  name: string | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

// Keep the token fresh only while the app is in the foreground (supabase-js on React Native)
AppState.addEventListener('change', (s) => {
  if (s === 'active') supabase.auth.startAutoRefresh()
  else supabase.auth.stopAutoRefresh()
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    void kvSet('user_id', session.user.id)
    const meta = session.user.user_metadata as { full_name?: string } | undefined
    setName(meta?.full_name ?? null)
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data: p }) => {
        if (p?.full_name) {
          setName(p.full_name as string)
          void kvSet('user_name', p.full_name as string)
        }
      }, () => undefined)
  }, [session])

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (error) throw error
    // This app is for surveyors only (role from the custom access token hook)
    if (roleFromToken(data.session.access_token) !== 'surveyor') {
      await supabase.auth.signOut()
      throw new Error('not_surveyor')
    }
    // One phone, one surveyor's unsynced work: never mix another person's queue into this login
    const prev = await kvGet('user_id')
    if (prev && prev !== data.session.user.id) {
      const pending = await db.getFirstAsync<{ n: number }>(`SELECT count(*) AS n FROM outbox WHERE status <> 'done'`)
      if ((pending?.n ?? 0) > 0) {
        await supabase.auth.signOut({ scope: 'local' })
        throw new Error('other_user_pending')
      }
      await db.execAsync(
        'DELETE FROM surveys; DELETE FROM units; DELETE FROM fittings; DELETE FROM fitting_conditions; DELETE FROM assessments; DELETE FROM attachments; DELETE FROM outbox;',
      )
    }
    await kvSet('user_id', data.session.user.id)
  }

  /** Signing out never clears the outbox or any unsynced photo. */
  async function signOut() {
    await supabase.auth.signOut({ scope: 'local' })
  }

  return <Ctx.Provider value={{ session, ready, name, signIn, signOut }}>{children}</Ctx.Provider>
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth outside AuthProvider')
  return v
}
