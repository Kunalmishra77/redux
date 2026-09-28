'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import type { Result } from '@/lib/result'

// Admin actions (D17). RLS limits every write here to super_admin; the rate-card freeze (D9-02) and
// activation (D9-03) are enforced by the database, so an activated version can never be edited.

const fail = (e: { code?: string; message: string }) => ({
  ok: false as const, code: e.code ?? 'FAILED',
  message: e.code === '42501' && /frozen|activated/.test(e.message) ? 'This version is in use and frozen — create a new version to change prices.'
    : e.code === '42501' ? 'Only the Super Admin can do that.'
    : ['22023', '23514', '23505'].includes(e.code ?? '') ? e.message.replace(/\s*\((BR|D)\d*-[A-Z0-9-]+\)/g, '') : 'That didn’t work. Try again.',
})

export async function newRateCardVersionAction(fromId: string) {
  await requireRole(['super_admin'])
  const supabase = await createClient()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
  const { data, error } = await supabase.rpc('new_rate_card_version', { p_effective_from: today, p_from: fromId, p_notes: 'Draft' })
  if (error) return fail(error)
  revalidatePath('/staff/admin/rate-card')
  redirect(`/staff/admin/rate-card?v=${data}`)
}

export async function setRatePriceAction(itemId: string, price: number, kind: 'rate' | 'market'): Promise<Result<null>> {
  if (!(price >= 0)) return { ok: false, code: 'PRICE', message: 'Enter a price of ₹0 or more.' }
  const supabase = await createClient()
  const { error } = await supabase.from(kind === 'rate' ? 'rate_card_items' : 'market_prices').update({ price }).eq('id', itemId)
  if (error) return fail(error)
  revalidatePath('/staff/admin/rate-card')
  return { ok: true, data: null }
}

export async function activateRateCardAction(id: string): Promise<Result<null>> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('activate_rate_card', { p_id: id })
  if (error) return fail(error)
  revalidatePath('/staff/admin/rate-card')
  return { ok: true, data: null }
}

export async function setSettingAction(key: string, value: string | number | boolean): Promise<Result<null>> {
  await requireRole(['super_admin'])
  const supabase = await createClient()
  const { error } = await supabase.from('settings').update({ value }).eq('key', key)
  if (error) return fail(error)
  revalidatePath('/staff/admin', 'layout')
  return { ok: true, data: null }
}

export async function toggleMasterAction(table: 'fitting_types' | 'brands' | 'finishes' | 'work_types' | 'lost_reasons' | 'call_outcomes' | 'condition_flags', id: string, active: boolean): Promise<Result<null>> {
  await requireRole(['super_admin'])
  const supabase = await createClient()
  const { error } = await supabase.from(table).update({ is_active: active }).eq('id', id)
  if (error) return fail(error)
  revalidatePath('/staff/admin/masters')
  return { ok: true, data: null }
}

export async function addMasterAction(table: 'fitting_types' | 'brands' | 'finishes' | 'lost_reasons' | 'condition_flags', name: string): Promise<Result<null>> {
  await requireRole(['super_admin'])
  const clean = name.trim()
  if (clean.length < 2) return { ok: false, code: 'NAME', message: 'Enter a name.' }
  const code = clean.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  const supabase = await createClient()
  const { error } = await supabase.from(table).insert((table === 'brands' ? { name: clean } : { code, name: clean }) as never)
  if (error) return fail(error.code === '23505' ? { ...error, message: 'That one already exists.' } : error)
  revalidatePath('/staff/admin/masters')
  return { ok: true, data: null }
}

export async function toggleRuleAction(id: string, active: boolean): Promise<Result<null>> {
  await requireRole(['super_admin'])
  const supabase = await createClient()
  const { error } = await supabase.from('notification_rules').update({ is_active: active }).eq('id', id)
  if (error) return fail(error)
  revalidatePath('/staff/admin/notifications')
  return { ok: true, data: null }
}
