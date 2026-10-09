'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePortalUser } from '@/lib/data/portal'
import type { Result } from '@/lib/result'

// CR-001 phase 4 (D27) — the customer's self-assessment (ADR-015, BR-S10). Every check — is this my
// account, is it still open, are all four photos there — is in the database functions; their
// messages are written for the customer.

const SHOWN = new Set(['P0002', '42501', '23514', '22023'])
const fail = (e: { code?: string; message: string }) =>
  ({ ok: false as const, code: e.code ?? 'FAILED', message: e.code && SHOWN.has(e.code) ? e.message.replace(/ \((BR|ADR)-[A-Z0-9-]+\)/g, '') : 'That didn’t save. Try again.' })

export async function startMySelfAssessmentAction(leadId: string): Promise<Result<null>> {
  await requirePortalUser()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('start_self_assessment', { p_lead: leadId, p_mode: 'self' })
  if (error) return fail(error)
  redirect(`/portal/self-assessment/${data}`)
}

const Fitting = z.object({
  unit_label: z.string().trim().min(1, 'Say which room or bathroom').max(40),
  fitting_type_id: z.uuid('Pick what kind of fitting it is'),
  current_finish_id: z.uuid().or(z.literal('')).optional(),
  brand_id: z.uuid().or(z.literal('')).optional(),
  notes: z.string().trim().max(500).optional(),
  condition_ids: z.array(z.uuid()).max(10),
})

export async function saveFittingAction(surveyId: string, input: z.input<typeof Fitting>, fittingId?: string): Promise<Result<{ id: string }>> {
  await requirePortalUser()
  const parsed = Fitting.safeParse(input)
  if (!parsed.success) return { ok: false, code: 'INVALID', message: parsed.error.issues[0]?.message ?? 'Check the details.' }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('self_assessment_save_fitting', { p_survey: surveyId, p: parsed.data, p_fitting: fittingId as string })
  if (error) return fail(error)
  revalidatePath(`/portal/self-assessment/${surveyId}`)
  return { ok: true, data: { id: data as string } }
}

export async function removeFittingAction(surveyId: string, fittingId: string): Promise<Result<null>> {
  await requirePortalUser()
  const supabase = await createClient()
  const { error } = await supabase.rpc('self_assessment_remove_fitting', { p_fitting: fittingId })
  if (error) return fail(error)
  revalidatePath(`/portal/self-assessment/${surveyId}`)
  return { ok: true, data: null }
}

export async function submitSelfAssessmentAction(surveyId: string): Promise<Result<null>> {
  await requirePortalUser()
  const supabase = await createClient()
  const { error } = await supabase.rpc('submit_self_assessment', { p_survey: surveyId })
  if (error) return fail(error)
  revalidatePath(`/portal/self-assessment/${surveyId}`)
  revalidatePath('/portal')
  return { ok: true, data: null }
}
