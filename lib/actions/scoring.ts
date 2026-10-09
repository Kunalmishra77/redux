'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import type { Result } from '@/lib/result'

// CR-001 phase 4 (E21, D27) — scoring, the assessment decision and self-assessment review. The rules
// live in the database functions (ADR-018, BR-SC1…SC3, BR-S9…S11); these actions authorise, validate
// and refresh. Exceptions raised by those functions are written for staff, so they are shown as-is.

type DbError = { code?: string; message: string } | null
const SHOWN = new Set(['P0002', '42501', '23514', '22023', '55000'])
const fail = (e: DbError, fallback = 'That didn’t save. Try again.') =>
  ({ ok: false as const, code: e?.code ?? 'FAILED', message: e && e.code && SHOWN.has(e.code) ? e.message.replace(/ \((BR|ADR)-[A-Z0-9-]+\)/g, '') : fallback })
const ok = <T,>(data: T) => ({ ok: true as const, data })

function refreshLead(leadId: string) {
  revalidatePath(`/staff/leads/${leadId}`)
  revalidatePath('/staff/leads', 'layout')
}

// ── lead decision ───────────────────────────────────────────────────────────
export async function rescoreLeadAction(leadId: string): Promise<Result<null>> {
  await requireRole(['super_admin', 'cc_exec'])
  const supabase = await createClient()
  const { error } = await supabase.rpc('score_lead', { p_lead: leadId })
  if (error) return fail(error)
  refreshLead(leadId)
  return ok(null)
}

// BR-SC3
export async function overrideTierAction(leadId: string, tier: 'A' | 'B' | 'C' | null, reason: string): Promise<Result<null>> {
  await requireRole(['super_admin'])
  const supabase = await createClient()
  const { error } = await supabase.rpc('override_lead_tier', { p_lead: leadId, p_tier: tier as string, p_reason: reason })
  if (error) return fail(error)
  refreshLead(leadId)
  return ok(null)
}

// BR-S9
export async function overrideAssessmentAction(leadId: string, mode: 'onsite' | 'self' | 'video' | null, demoOffer: 'room_demo' | 'fitting_demo' | 'none' | null, reason: string): Promise<Result<null>> {
  await requireRole(['super_admin', 'cc_exec'])
  const supabase = await createClient()
  const { error } = await supabase.rpc('override_assessment', { p_lead: leadId, p_mode: mode as string, p_demo_offer: demoOffer as string, p_reason: reason })
  if (error) return fail(error)
  refreshLead(leadId)
  return ok(null)
}

// ADR-015: the executive sends the customer a self-assessment (WhatsApp CN20 carries the link)
export async function startSelfAssessmentAction(leadId: string, mode: 'self' | 'video'): Promise<Result<{ surveyId: string }>> {
  await requireRole(['super_admin', 'cc_exec'])
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('start_self_assessment', { p_lead: leadId, p_mode: mode })
  if (error) return fail(error)
  refreshLead(leadId)
  revalidatePath('/staff/surveys')
  return ok({ surveyId: data as string })
}

// ── review (BR-S10, BR-S11) ─────────────────────────────────────────────────
const Price = z.object({
  fittingId: z.uuid(),
  recommended: z.enum(['restore_finish', 'repair_function', 'replace_eurobrass', 'no_action']),
  finishId: z.uuid().nullable(),
  note: z.string().trim().max(500).optional(),
  override: z.object({ reason: z.string().trim().min(3, 'Give a reason for the manual price'), price: z.number().min(0) }).nullable(),
})

export async function priceFittingAction(surveyId: string, input: z.input<typeof Price>): Promise<Result<null>> {
  await requireRole(['super_admin', 'surveyor'])
  const parsed = Price.safeParse(input)
  if (!parsed.success) return { ok: false, code: 'INVALID', message: parsed.error.issues[0]?.message ?? 'Check the form.' }
  const p = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.rpc('upsert_assessment', {
    p: {
      fitting_id: p.fittingId, recommended: p.recommended, finish_id: p.finishId ?? '', surveyor_note: p.note ?? '',
      ...(p.override ? { override: { reason: p.override.reason, price_recommended: p.override.price } } : {}),
    },
  })
  if (error) return fail(error)
  revalidatePath(`/staff/surveys/${surveyId}`)
  return ok(null)
}

export async function requestSelfAssessmentInfoAction(surveyId: string, request: string): Promise<Result<null>> {
  await requireRole(['super_admin', 'cc_exec', 'surveyor'])
  const supabase = await createClient()
  const { error } = await supabase.rpc('request_self_assessment_info', { p_survey: surveyId, p_request: request })
  if (error) return fail(error)
  revalidatePath(`/staff/surveys/${surveyId}`)
  revalidatePath('/staff/surveys')
  return ok(null)
}

export async function assignReviewerAction(surveyId: string, reviewerId: string | null): Promise<Result<null>> {
  await requireRole(['super_admin'])
  const supabase = await createClient()
  const { error } = await supabase.rpc('assign_self_assessment_reviewer', { p_survey: surveyId, p_reviewer: reviewerId as string })
  if (error) return fail(error)
  revalidatePath(`/staff/surveys/${surveyId}`)
  revalidatePath('/staff/surveys')
  return ok(null)
}

// ── admin: rules, thresholds, policy matrix, service areas (ADR-018) ───────
const Rule = z.object({
  id: z.uuid().optional(),
  factor: z.enum(['units', 'value', 'segment', 'source', 'distance_band', 'group_member', 'repeat_customer', 'referral']),
  operator: z.enum(['gte', 'between', 'in', 'is_true']),
  value: z.string().trim(),
  points: z.number().int().min(-100).max(100),
  label: z.string().trim().min(2).max(80),
  is_active: z.boolean(),
})

/** Parses the admin's text into the rule's jsonb value: "40", "10-39", "hotel, hospital". */
function ruleValue(op: string, raw: string): unknown {
  if (op === 'is_true') return null
  if (op === 'gte') { const n = Number(raw.replace(/[,₹\s]/g, '')); if (!Number.isFinite(n)) throw new Error('Enter a number'); return n }
  if (op === 'between') {
    const m = raw.replace(/[,₹\s]/g, '').match(/^(\d+(?:\.\d+)?)[-–](\d+(?:\.\d+)?)$/)
    if (!m) throw new Error('Enter a range like 10-39'); return [Number(m[1]), Number(m[2])]
  }
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean)
  if (!list.length) throw new Error('Enter at least one value'); return list
}

export async function saveScoringRuleAction(input: z.input<typeof Rule>): Promise<Result<null>> {
  await requireRole(['super_admin'])
  const parsed = Rule.safeParse(input)
  if (!parsed.success) return { ok: false, code: 'INVALID', message: parsed.error.issues[0]?.message ?? 'Check the rule.' }
  let value: unknown
  try { value = ruleValue(parsed.data.operator, parsed.data.value) } catch (e) { return { ok: false, code: 'INVALID', message: (e as Error).message } }
  const { id, ...rest } = parsed.data
  const row = { factor: rest.factor, operator: rest.operator, value: value as never, points: rest.points, label: rest.label, is_active: rest.is_active }
  const supabase = await createClient()
  const { error } = id ? await supabase.from('scoring_rules').update(row).eq('id', id) : await supabase.from('scoring_rules').insert({ ...row, sort_order: 100 })
  if (error) return fail(error)
  revalidatePath('/staff/admin/scoring')
  return ok(null)
}

export async function saveThresholdsAction(a: number, b: number): Promise<Result<null>> {
  await requireRole(['super_admin'])
  if (!(Number.isInteger(a) && Number.isInteger(b) && a > b && b >= 0)) return { ok: false, code: 'INVALID', message: 'Tier A must need more points than tier B.' }
  const supabase = await createClient()
  const { error } = await supabase.from('settings').update({ value: { A: a, B: b } }).eq('key', 'tier_thresholds')
  if (error) return fail(error)
  revalidatePath('/staff/admin/scoring')
  return ok(null)
}

const Policy = z.object({
  tier: z.enum(['A', 'B', 'C']), distance_band: z.enum(['near', 'far', 'unknown']),
  mode: z.enum(['onsite', 'self', 'video']), demo_offer: z.enum(['room_demo', 'fitting_demo', 'none']),
  owner_role: z.enum(['sales', 'cc_exec']), followup_days: z.number().int().min(0).max(90),
})
export async function savePolicyAction(input: z.input<typeof Policy>): Promise<Result<null>> {
  await requireRole(['super_admin'])
  const parsed = Policy.safeParse(input)
  if (!parsed.success) return { ok: false, code: 'INVALID', message: 'Check the policy.' }
  const { tier, distance_band, ...rest } = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.from('assessment_policies').update(rest).eq('tier', tier).eq('distance_band', distance_band)
  if (error) return fail(error)
  revalidatePath('/staff/admin/scoring')
  return ok(null)
}

export async function saveServiceAreaAction(id: string, nearKm: number, active: boolean): Promise<Result<null>> {
  await requireRole(['super_admin'])
  if (!(nearKm > 0 && nearKm <= 2000)) return { ok: false, code: 'INVALID', message: 'Enter a radius in km.' }
  const supabase = await createClient()
  const { error } = await supabase.from('service_areas').update({ near_km: nearKm, is_active: active }).eq('id', id)
  if (error) return fail(error)
  revalidatePath('/staff/admin/scoring')
  return ok(null)
}

export async function rescoreAllAction(): Promise<Result<{ count: number }>> {
  await requireRole(['super_admin'])
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('rescore_open_leads')
  if (error) return fail(error)
  revalidatePath('/staff/leads', 'layout')
  return ok({ count: data as number })
}

export type Preview = { score: number; tier: string; breakdown: { label: string; points: number }[]; band: string; km: number | null }
export async function previewScoreAction(input: { units?: number; value?: number; segment?: string; pincode?: string; group_member: boolean; repeat_customer: boolean; referral: boolean }): Promise<Result<Preview>> {
  await requireRole(['super_admin'])
  const supabase = await createClient()
  const { data: loc } = await supabase.rpc('locate', { p_pincode: input.pincode || (null as unknown as string), p_city: null as unknown as string })
  const l = (loc ?? { band: 'unknown', km: null }) as { band: string; km: number | null }
  const { data, error } = await supabase.rpc('evaluate_score', {
    p: { units: input.units ?? null, value: input.value ?? null, segment: input.segment || null, distance_band: l.band,
      group_member: input.group_member, repeat_customer: input.repeat_customer, referral: input.referral },
  })
  if (error) return fail(error)
  const r = data as { score: number; tier: string; breakdown: { label: string; points: number }[] }
  return ok({ ...r, band: l.band, km: l.km })
}
