import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type AppRole = 'super_admin' | 'cc_exec' | 'surveyor' | 'customer'
export type SessionUser = { id: string; email: string | null; role: AppRole; name: string }

/** Who is signed in — from the verified JWT (ADR-004: the role is a claim, set by the hook). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims?.sub) return null
  const role = (claims.user_role as AppRole | undefined) ?? 'customer'
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', claims.sub).maybeSingle()
  const meta = (claims.user_metadata ?? {}) as { full_name?: string }
  return {
    id: claims.sub,
    email: (claims.email as string | undefined) ?? null,
    role,
    name: profile?.full_name ?? meta.full_name ?? (claims.email as string | undefined) ?? 'You',
  }
})

export const STAFF_ROLES: AppRole[] = ['super_admin', 'cc_exec', 'surveyor']

export const HOME_FOR: Record<AppRole, string> = {
  super_admin: '/staff',
  cc_exec: '/staff/leads/mine',
  surveyor: '/staff/surveys',
  customer: '/portal',
}

/** Server-side gate for a page: the database enforces access (RLS); this only picks the screen. */
export async function requireRole(roles: AppRole[]): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) redirect('/staff/login')
  if (!roles.includes(user.role)) redirect(HOME_FOR[user.role])
  return user
}
