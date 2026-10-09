'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import type { Result } from '@/lib/result'

// CR-001 phase 6 (E23, D29) — referrals and rewards. The rules (BR-R1…R6) are in the database
// functions; their messages are written for staff.

const SHOWN = new Set(['P0002', '42501', '23514', '22023', '23505'])
const fail = (e: { code?: string; message: string }) =>
  ({ ok: false as const, code: e.code ?? 'FAILED', message: e.code && SHOWN.has(e.code) ? e.message.replace(/ \((BR|ADR)-[A-Z0-9-]+\)/g, '') : 'That didn’t save. Try again.' })

function refresh(...paths: string[]) {
  revalidatePath('/staff/referrals')
  for (const p of paths) if (p) revalidatePath(p)
}

/** Staff link a referral by hand: the referrer account, and the referred lead and/or account. */
export async function recordReferralAction(referrerId: string, leadId: string | null, customerId: string | null): Promise<Result<null>> {
  await requireRole(['super_admin', 'cc_exec'])
  const supabase = await createClient()
  const { error } = await supabase.rpc('record_referral', { p_referrer: referrerId, p_lead: leadId as string, p_customer: customerId as string })
  if (error) return fail(error)
  refresh(customerId ? `/staff/accounts/${customerId}` : '', `/staff/accounts/${referrerId}`, leadId ? `/staff/leads/${leadId}` : '')
  return { ok: true, data: null }
}

export async function rejectReferralAction(referralId: string, reason: string): Promise<Result<null>> {
  await requireRole(['super_admin'])
  if (reason.trim().length < 3) return { ok: false, code: 'INVALID', message: 'Say why.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('reject_referral', { p_referral: referralId, p_reason: reason })
  if (error) return fail(error)
  refresh()
  return { ok: true, data: null }
}

/** BR-R6: a credit against an issued invoice; a free fitting against a quotation. */
export async function redeemRewardAction(rewardId: string, target: { invoiceId?: string; quotationId?: string }, note: string): Promise<Result<null>> {
  await requireRole(['super_admin'])
  const supabase = await createClient()
  const { error } = await supabase.rpc('redeem_reward', {
    p_reward: rewardId, p_invoice: (target.invoiceId ?? null) as string, p_quotation: (target.quotationId ?? null) as string, p_note: note,
  })
  if (error) return fail(error)
  refresh('/staff/admin/invoices')
  return { ok: true, data: null }
}

export async function saveReferralProgrammeAction(v: { referred_discount_pct: number; referrer_credit_pct: number; free_fitting_every: number; reward_validity_days: number }): Promise<Result<null>> {
  await requireRole(['super_admin'])
  const ok = (n: number, lo: number, hi: number) => Number.isFinite(n) && n >= lo && n <= hi
  if (!(ok(v.referred_discount_pct, 0, 50) && ok(v.referrer_credit_pct, 0, 50) && ok(v.free_fitting_every, 0, 50) && ok(v.reward_validity_days, 30, 1095))) {
    return { ok: false, code: 'INVALID', message: 'Check the numbers: percentages 0–50, every 0–50 referrals, validity 30–1095 days.' }
  }
  const supabase = await createClient()
  const { error } = await supabase.from('settings').update({ value: v }).eq('key', 'referral_programme')
  if (error) return fail(error)
  refresh()
  return { ok: true, data: null }
}
