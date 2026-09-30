'use server'

import { revalidatePath } from 'next/cache'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/session'
import type { Result } from '@/lib/result'

// Users & roles (B29) and assignment (B30). Creating a login needs the auth admin API, so it runs
// with the service role — after requireRole() has confirmed the caller is a super_admin.

const NewStaff = z.object({
  full_name: z.string().trim().min(2, 'Enter their name'),
  email: z.email('Enter a valid email').transform((s) => s.toLowerCase()),
  phone: z.string().regex(/^\+91[6-9]\d{9}$/, 'Use a +91 mobile number'),
  role: z.enum(['super_admin', 'cc_exec', 'surveyor']),
  city_id: z.uuid().optional(),
})

export async function addStaffAction(input: z.input<typeof NewStaff>): Promise<Result<null>> {
  await requireRole(['super_admin'])
  const parsed = NewStaff.safeParse(input)
  if (!parsed.success) return { ok: false, code: 'INVALID', message: parsed.error.issues[0]?.message ?? 'Check the form.' }
  const u = parsed.data
  const admin = createAdminClient()
  // a random password nobody knows; the person sets their own from the invitation link
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email, password: randomBytes(24).toString('base64url'), email_confirm: true, user_metadata: { full_name: u.full_name },
  })
  if (error) return { ok: false, code: 'AUTH', message: /already/.test(error.message) ? 'Someone already has that email.' : 'Couldn’t create the login.' }
  const id = data.user.id
  const p = await admin.from('profiles').insert({ id, full_name: u.full_name, email: u.email, phone: u.phone, city_id: u.city_id ?? null })
  const r = await admin.from('user_roles').insert({ user_id: id, role: u.role })
  if (p.error || r.error) return { ok: false, code: 'PROFILE', message: 'The login exists but the profile didn’t save. Try again.' }
  revalidatePath('/staff/admin/users')
  return { ok: true, data: null }
}

export async function setStaffActiveAction(userId: string, active: boolean): Promise<Result<null>> {
  const user = await requireRole(['super_admin'])
  if (userId === user.id && !active) return { ok: false, code: 'SELF', message: 'You can’t deactivate yourself.' }
  const supabase = await createClient()
  const { error } = await supabase.from('profiles').update({ is_active: active }).eq('id', userId)
  if (error) return { ok: false, code: error.code ?? 'FAILED', message: 'That didn’t work. Try again.' }
  revalidatePath('/staff/admin/users')
  revalidatePath('/staff/admin/assignment')
  return { ok: true, data: null }
}

export async function setStaffCityAction(userId: string, cityId: string | null): Promise<Result<null>> {
  await requireRole(['super_admin'])
  const supabase = await createClient()
  const { error } = await supabase.from('profiles').update({ city_id: cityId }).eq('id', userId)
  if (error) return { ok: false, code: error.code ?? 'FAILED', message: 'That didn’t work. Try again.' }
  revalidatePath('/staff/admin/users')
  revalidatePath('/staff/admin/assignment')
  return { ok: true, data: null }
}

const MyProfile = z.object({
  full_name: z.string().trim().min(2, 'Enter your name'),
  phone: z.string().trim().transform((s) => s.replace(/[\s-]/g, '')).pipe(z.string().regex(/^\+91[6-9]\d{9}$/, 'Use a +91 mobile number')),
})

// B4: my own contact fields — RLS (profiles_update_self) and the guard limit this to name and phone
export async function updateMyProfileAction(input: z.input<typeof MyProfile>): Promise<Result<null>> {
  const user = await requireRole(['super_admin', 'cc_exec', 'surveyor'])
  const parsed = MyProfile.safeParse(input)
  if (!parsed.success) return { ok: false, code: 'INVALID', message: parsed.error.issues[0]?.message ?? 'Check the form.' }
  const supabase = await createClient()
  const { error } = await supabase.from('profiles').update(parsed.data).eq('id', user.id)
  if (error) return { ok: false, code: error.code ?? 'FAILED', message: 'That didn’t save. Try again.' }
  revalidatePath('/staff', 'layout')
  return { ok: true, data: null }
}
