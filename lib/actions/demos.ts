'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { requirePortalUser } from '@/lib/data/portal'
import type { Result } from '@/lib/result'

// CR-001 phase 5 (E22, D28) — free demos. Every rule (BR-D1…D4: approval, eligibility, scope, cost,
// warranty, conversion) is in the database functions; their messages are written for staff.

const SHOWN = new Set(['P0002', '42501', '23514', '22023'])
const fail = (e: { code?: string; message: string }) =>
  ({ ok: false as const, code: e.code ?? 'FAILED', message: e.code && SHOWN.has(e.code) ? e.message.replace(/ \((BR|ADR)-[A-Z0-9-]+\)/g, '') : 'That didn’t save. Try again.' })

function refresh(demoId?: string) {
  revalidatePath('/staff/demos')
  if (demoId) revalidatePath(`/staff/demos/${demoId}`)
}

const Proposal = z.object({
  customerId: z.uuid(),
  leadId: z.uuid().nullable(),
  type: z.enum(['room_demo', 'fitting_demo']),
  fittingIds: z.array(z.uuid()).min(1, 'Choose at least one fitting'),
  note: z.string().trim().max(500).optional(),
  exceptionReason: z.string().trim().max(300).optional(),
})

export async function proposeDemoAction(input: z.input<typeof Proposal>): Promise<Result<{ id: string }>> {
  await requireRole(['super_admin', 'cc_exec'])
  const parsed = Proposal.safeParse(input)
  if (!parsed.success) return { ok: false, code: 'INVALID', message: parsed.error.issues[0]?.message ?? 'Check the form.' }
  const p = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('propose_demo', {
    p: { customer_id: p.customerId, lead_id: p.leadId ?? '', type: p.type, note: p.note ?? '', exception_reason: p.exceptionReason ?? '',
      items: p.fittingIds.map((id) => ({ fitting_id: id })) },
  })
  if (error) return fail(error)
  refresh()
  revalidatePath(`/staff/accounts/${p.customerId}`)
  if (p.leadId) revalidatePath(`/staff/leads/${p.leadId}`)
  return { ok: true, data: { id: data as string } }
}

export async function decideDemoAction(demoId: string, approve: boolean, note: string): Promise<Result<null>> {
  await requireRole(['super_admin'])
  const supabase = await createClient()
  const { error } = await supabase.rpc('decide_demo', { p_demo: demoId, p_approve: approve, p_note: note })
  if (error) return fail(error)
  refresh(demoId)
  return { ok: true, data: null }
}

export async function scheduleDemoAction(demoId: string, date: string): Promise<Result<{ jobId: string }>> {
  await requireRole(['super_admin', 'cc_exec'])
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, code: 'INVALID', message: 'Pick a date.' }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('schedule_demo', { p_demo: demoId, p_date: date })
  if (error) return fail(error)
  refresh(demoId)
  revalidatePath('/staff/jobs')
  return { ok: true, data: { jobId: data as string } }
}

const Outcome = z.object({
  result: z.enum(['pass', 'needs_work']).optional(),
  internal_cost: z.number().min(0).max(10_000_000).optional(),
  feedback: z.string().trim().max(2000).optional(),
})
export async function recordDemoOutcomeAction(demoId: string, input: z.input<typeof Outcome>): Promise<Result<null>> {
  await requireRole(['super_admin', 'cc_exec'])
  const parsed = Outcome.safeParse(input)
  if (!parsed.success) return { ok: false, code: 'INVALID', message: 'Check the form.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('record_demo_outcome', { p_demo: demoId, p: parsed.data })
  if (error) return fail(error)
  refresh(demoId)
  return { ok: true, data: null }
}

export async function closeDemoAction(demoId: string, outcome: 'not_converted' | 'cancelled', note: string): Promise<Result<null>> {
  await requireRole(['super_admin', 'cc_exec'])
  const supabase = await createClient()
  const { error } = await supabase.rpc('close_demo', { p_demo: demoId, p_outcome: outcome, p_note: note })
  if (error) return fail(error)
  refresh(demoId)
  return { ok: true, data: null }
}

export async function saveDemoTypeAction(id: string, input: { max_fittings: number; max_units: number; cost_cap: number | null; eligible_tiers: string[]; is_active: boolean }): Promise<Result<null>> {
  await requireRole(['super_admin'])
  const tiers = input.eligible_tiers.filter((t) => ['A', 'B', 'C'].includes(t))
  if (!(input.max_fittings > 0 && input.max_units > 0)) return { ok: false, code: 'INVALID', message: 'Scope must be at least one.' }
  const supabase = await createClient()
  const { error } = await supabase.from('demo_types').update({ ...input, eligible_tiers: tiers }).eq('id', id)
  if (error) return fail(error)
  refresh()
  return { ok: true, data: null }
}

// portal: the customer rates their finished demo
export async function rateMyDemoAction(demoId: string, rating: number, comment: string): Promise<Result<null>> {
  await requirePortalUser()
  const supabase = await createClient()
  const { error } = await supabase.rpc('rate_my_demo', { p_demo: demoId, p_rating: rating, p_comment: comment })
  if (error) return fail(error)
  revalidatePath('/portal')
  return { ok: true, data: null }
}
