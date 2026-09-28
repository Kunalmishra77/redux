'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/auth/session'
import { ingestLead } from '@/lib/leads/ingest'
import { bookSurvey } from '@/lib/surveys/book'
import type { Result } from '@/lib/result'

// Server Actions orchestrate (auth, validate, call the database function, refresh); the rules live
// in the database functions and lib/services (coding standards). Messages are for the executive.

const fail = (code: string, message: string) => ({ ok: false as const, code, message })

function refresh(leadId?: string) {
  revalidatePath('/staff/leads', 'layout')
  if (leadId) revalidatePath(`/staff/leads/${leadId}`)
}

// D4-02/03: log a call with its outcome (log_call moves a new lead to contacted)
export async function logCallAction(input: { leadId: string; outcome: string; note?: string; durationSec?: number }): Promise<Result<null>> {
  const supabase = await createClient()
  const started = new Date(Date.now() - (input.durationSec ?? 0) * 1000)
  const { error } = await supabase.rpc('log_call', {
    p_call: { lead_id: input.leadId, outcome: input.outcome, outcome_note: input.note, started_at: started.toISOString(), ended_at: new Date().toISOString() },
  })
  if (error) return fail('CALL_FAILED', error.code === '23514' ? 'This outcome needs a short note.' : 'The call could not be logged. Try again.')
  refresh(input.leadId)
  return { ok: true, data: null }
}

// D4-04/05: who is free for this slot (same city first, then least busy)
export async function availableSurveyorsAction(scheduledAt: string, propertyId?: string) {
  const supabase = await createClient()
  const { data } = await supabase.rpc('available_surveyors', { p_property_id: propertyId ?? null as unknown as string, p_start: scheduledAt })
  return (data ?? []).map((s: { surveyor_id: string; full_name: string; same_city: boolean; surveys_that_day: number }) => ({ id: s.surveyor_id, name: s.full_name, sameCity: s.same_city, load: s.surveys_that_day }))
}

// D4-04: book the free survey without leaving the lead (BR-S8 prospect, BR-S2, BR-L6)
export async function bookSurveyAction(input: unknown): Promise<Result<{ surveyId: string }>> {
  const supabase = await createClient()
  const r = await bookSurvey(supabase, input)
  if (!r.ok) return r
  refresh((input as { lead_id?: string }).lead_id)
  revalidatePath('/staff/surveys')
  return { ok: true, data: { surveyId: r.data.surveyId } }
}

// BR-L7: lost needs a reason from the list (and a note for "other")
export async function markLostAction(input: { leadId: string; reasonCode: string; note?: string }): Promise<Result<null>> {
  const supabase = await createClient()
  const { data: reason } = await supabase.from('lost_reasons').select('id, requires_note').eq('code', input.reasonCode).single()
  if (!reason) return fail('LOST_REASON', 'Choose why the lead was lost.')
  if (reason.requires_note && !input.note?.trim()) return fail('LOST_NOTE', 'Add a short note for “Other”.')
  const { error } = await supabase.from('leads')
    .update({ status: 'lost', lost_reason_id: reason.id, lost_note: input.note?.trim() || null }).eq('id', input.leadId)
  if (error) return fail('LOST_FAILED', 'The lead could not be updated.')
  refresh(input.leadId)
  return { ok: true, data: null }
}

// BR-L8: a lost lead can be reopened; both events stay in the timeline
export async function reopenLeadAction(leadId: string): Promise<Result<null>> {
  const supabase = await createClient()
  const { error } = await supabase.from('leads').update({ status: 'contacted', lost_reason_id: null, lost_note: null }).eq('id', leadId)
  if (error) return fail('REOPEN_FAILED', error.code === '23505'
    ? 'This number already has an open lead — work that one instead.'
    : 'The lead could not be reopened.')
  refresh(leadId)
  return { ok: true, data: null }
}

// Pipeline board (B8): only New ↔ Contacted and Lost move by hand. Later stages follow the work
// itself (survey booked, submitted, quoted, won — BR-L6), so a drag there explains instead of moving.
export async function moveLeadAction(leadId: string, to: string): Promise<Result<null>> {
  if (['survey_booked', 'surveyed', 'quoted', 'won'].includes(to)) {
    return fail('SYSTEM_STAGE', to === 'survey_booked'
      ? 'Book the survey from the lead — the card moves when the survey exists.'
      : 'This stage follows the work itself: submitting the survey, sending the quote, the customer’s approval.')
  }
  if (to === 'lost') return fail('NEEDS_REASON', 'Choose a reason.')
  const supabase = await createClient()
  const { error } = await supabase.from('leads').update({ status: to as 'new' | 'contacted' }).eq('id', leadId)
  if (error) return fail('MOVE_FAILED', 'The lead could not be moved.')
  refresh(leadId)
  return { ok: true, data: null }
}

export async function addNoteAction(leadId: string, body: string): Promise<Result<null>> {
  const text = body.trim()
  if (!text) return fail('NOTE_EMPTY', 'Write the note first.')
  const user = await getSessionUser()
  if (!user) return fail('AUTH', 'Sign in again.')
  const supabase = await createClient()
  const { error } = await supabase.from('lead_notes').insert({ lead_id: leadId, author_id: user.id, body: text })
  if (error) return fail('NOTE_FAILED', 'The note could not be saved.')
  refresh(leadId)
  return { ok: true, data: null }
}

// D4-07: follow-up reminders
export async function createFollowUpAction(input: { leadId: string; dueAt: string; note?: string }): Promise<Result<null>> {
  const user = await getSessionUser()
  if (!user) return fail('AUTH', 'Sign in again.')
  const supabase = await createClient()
  const { data: lead } = await supabase.from('leads').select('assigned_to').eq('id', input.leadId).single()
  const { error } = await supabase.from('follow_ups').insert({
    lead_id: input.leadId, assigned_to: lead?.assigned_to ?? user.id, due_at: input.dueAt, note: input.note?.trim() || null,
  })
  if (error) return fail('FOLLOW_UP_FAILED', 'The reminder could not be set.')
  refresh(input.leadId)
  revalidatePath('/staff/follow-ups')
  return { ok: true, data: null }
}

export async function completeFollowUpAction(id: string, leadId?: string): Promise<Result<null>> {
  const supabase = await createClient()
  const { error } = await supabase.from('follow_ups').update({ completed_at: new Date().toISOString() }).eq('id', id)
  if (error) return fail('FOLLOW_UP_FAILED', 'Could not mark it done.')
  refresh(leadId)
  revalidatePath('/staff/follow-ups')
  return { ok: true, data: null }
}

// B9: manual entry for calls and walk-ins, with the caller's verbal consent (D2-11, BR-P1)
const manualSchema = z.object({
  phone: z.string().min(5, 'Enter the phone number'),
  name: z.string().trim().min(2, 'Enter the name'),
  source: z.enum(['call', 'walk_in', 'dealer']),
  customer_type: z.enum(['home', 'hotel', 'dealer', 'other']),
  city_id: z.uuid().optional(),
  property_name: z.string().trim().optional(),
  unit_count: z.coerce.number().int().positive().optional(),
  email: z.union([z.email(), z.literal('')]).optional(),
  marketing: z.boolean().optional(),
})

export async function createLeadAction(input: unknown): Promise<Result<{ leadId: string; created: boolean }>> {
  const parsed = manualSchema.safeParse(input)
  if (!parsed.success) return fail('LEAD_INVALID', parsed.error.issues[0]?.message ?? 'Check the form.')
  const supabase = await createClient()
  const { data: notice } = await supabase.from('privacy_notices').select('version').eq('is_active', true).eq('language', 'en').maybeSingle()
  const { email, marketing, ...rest } = parsed.data
  const r = await ingestLead(supabase, { ...rest, email: email || undefined, property_name: rest.property_name || undefined },
    notice ? { notice_version: notice.version, method: 'verbal_call', purposes: { service: true, marketing: !!marketing } } : undefined)
  if (!r.ok) return r
  refresh(r.data.leadId)
  return r
}
