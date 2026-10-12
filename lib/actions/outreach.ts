'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/session'
import type { Result } from '@/lib/result'
import { audienceSchema as Audience, type AudienceInput, type AudiencePreview } from '@/lib/validators/outreach'

// CR-001 phase 9 (E26, D32) — offers, cadences and outreach campaigns. Consent, the frequency cap,
// quiet hours, the template gate and "preview = send" (BR-C1…C3) are all in the database functions.

const SHOWN = new Set(['P0002', '42501', '23514', '22023', '23505'])
const fail = (e: { code?: string; message: string }) =>
  ({ ok: false as const, code: e.code ?? 'FAILED', message: e.code && SHOWN.has(e.code) ? e.message.replace(/ \((BR|ADR)-[A-Z0-9-]+\)/g, '') : 'That didn’t save. Try again.' })

export async function previewAudienceAction(audience: AudienceInput, channel: 'whatsapp' | 'email'): Promise<Result<AudiencePreview>> {
  await requireRole(['super_admin', 'cc_exec'])
  const parsed = Audience.safeParse(audience)
  if (!parsed.success) return { ok: false, code: 'INVALID', message: 'Check the audience.' }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('preview_audience', { p: parsed.data, p_channel: channel })
  if (error) return fail(error)
  return { ok: true, data: data as AudiencePreview }
}

const Campaign = z.object({
  name: z.string().trim().min(3, 'Name the campaign').max(120),
  channel: z.enum(['whatsapp', 'email']),
  template_code: z.string().min(1, 'Choose a template'),
  offer_id: z.uuid().nullable(),
  audience: Audience,
  scheduled_at: z.string().nullable(),
  launch: z.boolean(),
})

export async function saveCampaignAction(input: z.input<typeof Campaign>): Promise<Result<{ id: string }>> {
  const user = await requireRole(['super_admin'])
  const parsed = Campaign.safeParse(input)
  if (!parsed.success) return { ok: false, code: 'INVALID', message: parsed.error.issues[0]?.message ?? 'Check the campaign.' }
  const c = parsed.data
  const supabase = await createClient()
  const scheduled = c.scheduled_at && !c.launch ? new Date(`${c.scheduled_at}:00+05:30`).toISOString() : null
  const { data, error } = await supabase.from('outreach_campaigns').insert({
    name: c.name, channel: c.channel, template_code: c.template_code, offer_id: c.offer_id, audience: c.audience,
    status: scheduled ? 'scheduled' : 'draft', scheduled_at: scheduled, created_by: user.id,
  }).select('id').single()
  if (error) return fail(error)
  if (c.launch) {
    const { error: e2 } = await supabase.rpc('launch_campaign', { p_campaign: data.id })
    if (e2) return fail(e2)
  }
  revalidatePath('/staff/campaigns')
  redirect(`/staff/campaigns/${data.id}`)
}

export async function launchCampaignAction(id: string): Promise<Result<{ queued: number; skipped: number }>> {
  await requireRole(['super_admin'])
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('launch_campaign', { p_campaign: id })
  if (error) return fail(error)
  revalidatePath(`/staff/campaigns/${id}`)
  revalidatePath('/staff/campaigns')
  return { ok: true, data: data as { queued: number; skipped: number } }
}

export async function cancelCampaignAction(id: string): Promise<Result<null>> {
  await requireRole(['super_admin'])
  const supabase = await createClient()
  const { error } = await supabase.from('outreach_campaigns').update({ status: 'cancelled' }).eq('id', id).in('status', ['draft', 'scheduled'])
  if (error) return fail(error)
  revalidatePath(`/staff/campaigns/${id}`)
  return { ok: true, data: null }
}

const Offer = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,16}$/, 'Code: 3–16 letters or digits'),
  title: z.string().trim().min(3).max(80),
  discount_pct: z.number().min(0.5).max(50),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick the last valid day'),
  eligible_tiers: z.array(z.enum(['A', 'B', 'C'])).min(1, 'At least one tier'),
  max_redemptions: z.number().int().positive().nullable(),
})
export async function createOfferAction(input: z.input<typeof Offer>): Promise<Result<null>> {
  const user = await requireRole(['super_admin'])
  const parsed = Offer.safeParse(input)
  if (!parsed.success) return { ok: false, code: 'INVALID', message: parsed.error.issues[0]?.message ?? 'Check the offer.' }
  const supabase = await createClient()
  const { error } = await supabase.from('offers').insert({ ...parsed.data, created_by: user.id })
  if (error) return fail(error.code === '23505' ? { code: '23505', message: 'That code is already used.' } : error)
  revalidatePath('/staff/campaigns')
  return { ok: true, data: null }
}

export async function setOfferActiveAction(id: string, active: boolean): Promise<Result<null>> {
  await requireRole(['super_admin'])
  const supabase = await createClient()
  const { error } = await supabase.from('offers').update({ is_active: active }).eq('id', id)
  if (error) return fail(error)
  revalidatePath('/staff/campaigns')
  return { ok: true, data: null }
}

export async function setCadenceActiveAction(id: string, active: boolean): Promise<Result<null>> {
  await requireRole(['super_admin'])
  const supabase = await createClient()
  const { error } = await supabase.from('followup_cadences').update({ is_active: active }).eq('id', id)
  if (error) return fail(error)
  revalidatePath('/staff/campaigns')
  return { ok: true, data: null }
}

// quote page: apply an offer code (BR-R5 decides whether it replaces the referral discount)
export async function applyOfferAction(quoteId: string, code: string): Promise<Result<{ applied: boolean; reason?: string }>> {
  await requireRole(['super_admin', 'surveyor'])
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('apply_offer', { p_quote: quoteId, p_code: code })
  if (error) return fail(error)
  revalidatePath(`/staff/quotes/${quoteId}`)
  return { ok: true, data: data as { applied: boolean; reason?: string } }
}

// DEMO ONLY — stands in for the WhatsApp webhook: a recipient replies (YES / STOP). In production the
// reply arrives through the verified Meta webhook and lands in the same table.
export async function simulateReplyAction(phone: string, text: string): Promise<Result<null>> {
  await requireRole(['super_admin'])
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') return { ok: false, code: 'DEMO_ONLY', message: 'Only in the demo.' }
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return { ok: false, code: 'INVALID', message: 'Bad phone.' }
  const admin = createAdminClient()
  const waId = phone.slice(1)
  const { data: lead } = await admin.from('leads').select('id').eq('phone', phone).order('created_at', { ascending: false }).limit(1).maybeSingle()
  const { data: conv, error: e1 } = await admin.from('whatsapp_conversations').upsert({ wa_id: waId, lead_id: lead?.id ?? null, last_message_at: new Date().toISOString() }, { onConflict: 'wa_id' }).select('id').single()
  if (e1) return fail(e1)
  const { error } = await admin.from('whatsapp_messages').insert({ conversation_id: conv.id, direction: 'inbound', kind: 'text', body: text.slice(0, 500) })
  if (error) return fail(error)
  revalidatePath('/staff/campaigns', 'layout')
  return { ok: true, data: null }
}
