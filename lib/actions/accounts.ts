'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import type { Result } from '@/lib/result'

// Accounts (E18, D24). Profile fields and verification are Super Admin edits (customers_write_admin
// RLS); the audit trigger on customers records every change (BR-X4).

const Profile = z.object({
  legal_name: z.string().trim().max(200).optional().transform((s) => s || null),
  segment_id: z.uuid().nullable(),
  group_id: z.uuid().nullable(),
  account_owner_id: z.uuid().nullable(),
  size_units: z.number().int().min(0).nullable(),
})

export async function updateAccountProfileAction(id: string, input: z.input<typeof Profile>): Promise<Result<null>> {
  await requireRole(['super_admin'])
  const parsed = Profile.safeParse(input)
  if (!parsed.success) return { ok: false, code: 'INVALID', message: parsed.error.issues[0]?.message ?? 'Check the form.' }
  const supabase = await createClient()
  const { error } = await supabase.from('customers').update(parsed.data).eq('id', id)
  if (error) return { ok: false, code: error.code ?? 'FAILED', message: 'That didn’t save. Try again.' }
  revalidatePath(`/staff/accounts/${id}`)
  return { ok: true, data: null }
}

// BR-B2: verification unlocks full history and reports for the account's contacts
export async function setAccountVerifiedAction(id: string, verified: boolean): Promise<Result<null>> {
  const user = await requireRole(['super_admin'])
  const supabase = await createClient()
  const { error } = await supabase.from('customers')
    .update(verified ? { verified_at: new Date().toISOString(), verified_by: user.id } : { verified_at: null, verified_by: null }).eq('id', id)
  if (error) return { ok: false, code: error.code ?? 'FAILED', message: 'That didn’t save. Try again.' }
  revalidatePath(`/staff/accounts/${id}`)
  revalidatePath('/staff/accounts')
  return { ok: true, data: null }
}

export async function createGroupAction(name: string): Promise<Result<{ id: string }>> {
  await requireRole(['super_admin'])
  const clean = name.trim()
  if (clean.length < 2) return { ok: false, code: 'NAME', message: 'Enter the group name.' }
  const supabase = await createClient()
  const { data, error } = await supabase.from('customer_groups').insert({ name: clean }).select('id').single()
  if (error) return { ok: false, code: error.code ?? 'FAILED', message: error.code === '23505' ? 'That group already exists.' : 'That didn’t save. Try again.' }
  return { ok: true, data: { id: data.id } }
}

// ADR-017: a manual entry on the account timeline (meeting, site visit, call note)
export async function addAccountActivityAction(customerId: string, kind: 'meeting' | 'visit' | 'call_note' | 'email' | 'other', title: string, body?: string): Promise<Result<null>> {
  const user = await requireRole(['super_admin', 'cc_exec'])
  if (title.trim().length < 2) return { ok: false, code: 'TITLE', message: 'Say what happened.' }
  const supabase = await createClient()
  const { error } = await supabase.from('account_activities').insert({ customer_id: customerId, kind, title: title.trim(), body: body?.trim() || null, actor_id: user.id })
  if (error) return { ok: false, code: error.code ?? 'FAILED', message: 'That didn’t save. Try again.' }
  revalidatePath(`/staff/accounts/${customerId}`)
  return { ok: true, data: null }
}

// D26 — what the account needs now and later, and the next step. The RPC decides who may edit
// (Super Admin, the account owner, or the executive working one of its leads).
const Requirements = z.object({
  current_requirements: z.string().trim().max(2000),
  future_requirements: z.string().trim().max(2000),
  next_action: z.string().trim().max(300),
  next_action_at: z.string().trim().refine((s) => s === '' || !Number.isNaN(Date.parse(s)), 'Pick a valid date'),
  website: z.string().trim().max(200).refine((s) => s === '' || /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(s), 'Enter a website like hotel.com'),
})

export async function updateAccountRequirementsAction(id: string, input: z.input<typeof Requirements>): Promise<Result<null>> {
  await requireRole(['super_admin', 'cc_exec'])
  const parsed = Requirements.safeParse(input)
  if (!parsed.success) return { ok: false, code: 'INVALID', message: parsed.error.issues[0]?.message ?? 'Check the form.' }
  const p = { ...parsed.data, next_action_at: parsed.data.next_action_at ? new Date(`${parsed.data.next_action_at}T10:00:00+05:30`).toISOString() : '' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('update_account_requirements', { p_customer: id, p })
  if (error) return { ok: false, code: error.code ?? 'FAILED', message: error.code === '42501' ? 'Only the account owner, its executive or the Super Admin can edit this.' : 'That didn’t save. Try again.' }
  revalidatePath(`/staff/accounts/${id}`)
  return { ok: true, data: null }
}
