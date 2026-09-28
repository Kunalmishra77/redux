'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { HOME_FOR, type AppRole } from '@/lib/auth/session'

const signInSchema = z.object({
  email: z.email('Enter your work email'),
  password: z.string().min(1, 'Enter your password'),
  next: z.string().optional(),
})

export type SignInState = { error?: string; fieldErrors?: Partial<Record<'email' | 'password', string>> }

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    const fieldErrors: SignInState['fieldErrors'] = {}
    for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as 'email' | 'password'] = issue.message
    return { fieldErrors }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password })
  if (error) return { error: 'That email and password don’t match. Check them and try again.' }

  const { data } = await supabase.auth.getClaims()
  const role = (data?.claims?.user_role as AppRole | undefined) ?? 'customer'
  if (role === 'customer') {
    await supabase.auth.signOut()
    return { error: 'This login is for the REDUX team. Customers sign in at the customer portal.' }
  }
  const next = parsed.data.next?.startsWith('/staff') ? parsed.data.next : HOME_FOR[role]
  redirect(next)
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/staff/login')
}
