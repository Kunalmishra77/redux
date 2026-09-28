// Provider payloads → our shapes. Pure: no network, no database, so every mapping is unit-tested.
// Zod at the boundary (coding standards); unknown fields are ignored because providers add them
// without notice (Google Ads contract).

import { z } from 'zod'
import type { LeadIntake } from '@/lib/validators/leads'

// ---------------------------------------------------------------------------
// Google Ads lead form webhook
// ---------------------------------------------------------------------------
export const googleLeadSchema = z.looseObject({
  lead_id: z.string(),
  form_id: z.union([z.string(), z.number()]).optional(),
  campaign_id: z.union([z.string(), z.number()]).optional(),
  gcl_id: z.string().optional(),
  is_test: z.boolean().optional(),
  google_key: z.string().optional(),
  user_column_data: z
    .array(z.looseObject({ column_id: z.string().optional(), column_name: z.string().optional(), string_value: z.string().optional() }))
    .default([]),
})
export type GoogleLead = z.infer<typeof googleLeadSchema>

// Google's standard column ids; custom questions arrive as their own ids and are mapped by
// lead_form_field_map (provider 'google_ads').
const GOOGLE_COLUMNS: Record<string, keyof LeadIntake> = {
  PHONE_NUMBER: 'phone',
  FULL_NAME: 'name',
  EMAIL: 'email',
}

export function mapGoogleLead(lead: GoogleLead, fieldMap: Record<string, string> = {}): Partial<LeadIntake> {
  const intake: Record<string, unknown> = {
    source: 'google_ads',
    google_lead_id: lead.lead_id,
    utm: lead.gcl_id ? { gclid: lead.gcl_id } : undefined,
    // never store the shared secret
    raw_payload: Object.fromEntries(Object.entries(lead).filter(([key]) => key !== 'google_key')),
  }
  let first = ''
  let last = ''
  for (const col of lead.user_column_data) {
    const id = col.column_id ?? ''
    const value = col.string_value?.trim()
    if (!value) continue
    if (id === 'FIRST_NAME') first = value
    else if (id === 'LAST_NAME') last = value
    const target = fieldMap[id] ?? GOOGLE_COLUMNS[id]
    if (target && !(target in intake && intake[target])) intake[target] = value
  }
  if (!intake.name && (first || last)) intake.name = `${first} ${last}`.trim()
  return intake as Partial<LeadIntake>
}

// ---------------------------------------------------------------------------
// Meta Lead Ads: the webhook carries ids only; the lead is fetched from the Graph API
// ---------------------------------------------------------------------------
const metaChangeSchema = z.looseObject({
  field: z.string(),
  value: z.looseObject({
    leadgen_id: z.union([z.string(), z.number()]).optional(),
    form_id: z.union([z.string(), z.number()]).optional(),
    ad_id: z.union([z.string(), z.number()]).optional(),
    page_id: z.union([z.string(), z.number()]).optional(),
  }),
})
export const metaWebhookSchema = z.looseObject({
  object: z.string(),
  entry: z.array(z.looseObject({ changes: z.array(metaChangeSchema).default([]) })).default([]),
})

/** Every leadgen id in one POST (Meta batches several changes into one delivery). */
export function extractLeadgenIds(body: unknown): string[] {
  const parsed = metaWebhookSchema.safeParse(body)
  if (!parsed.success) return []
  return parsed.data.entry
    .flatMap((e) => e.changes)
    .filter((c) => c.field === 'leadgen' && c.value.leadgen_id !== undefined)
    .map((c) => String(c.value.leadgen_id))
}

export const metaLeadSchema = z.looseObject({
  id: z.string(),
  ad_id: z.string().optional(),
  form_id: z.string().optional(),
  campaign_id: z.string().optional(),
  field_data: z.array(z.looseObject({ name: z.string(), values: z.array(z.string()).default([]) })).default([]),
})
export type MetaLead = z.infer<typeof metaLeadSchema>

// Meta's standard field names; custom questions are auto-slugged and change when the marketer edits
// them, so they are only ever mapped through lead_form_field_map — never hardcoded here.
const META_FIELDS: Record<string, keyof LeadIntake> = {
  phone_number: 'phone',
  full_name: 'name',
  email: 'email',
}

export function mapMetaLead(lead: MetaLead, fieldMap: Record<string, string> = {}): Partial<LeadIntake> {
  const intake: Record<string, unknown> = {
    source: 'meta_lead_ad',
    meta_leadgen_id: lead.id,
    meta_ad_id: lead.ad_id,
    meta_form_id: lead.form_id,
    raw_payload: lead,
  }
  for (const f of lead.field_data) {
    const value = f.values[0]?.trim()
    if (!value) continue
    const target = fieldMap[f.name] ?? META_FIELDS[f.name]
    if (target && !intake[target]) intake[target] = value
  }
  return intake as Partial<LeadIntake>
}

// ---------------------------------------------------------------------------
// WhatsApp Cloud API `messages` webhook
// ---------------------------------------------------------------------------
const waReferralSchema = z.looseObject({
  source_id: z.string().optional(),
  source_type: z.string().optional(),
  source_url: z.string().optional(),
  ctwa_clid: z.string().optional(),
  headline: z.string().optional(),
})
const waMessageSchema = z.looseObject({
  id: z.string(),
  from: z.string(),
  timestamp: z.string(),
  type: z.string(),
  text: z.looseObject({ body: z.string() }).optional(),
  context: z.looseObject({ id: z.string().optional() }).optional(),
  referral: waReferralSchema.optional(),
})
const waStatusSchema = z.looseObject({
  id: z.string(),
  status: z.string(),
  timestamp: z.string(),
  recipient_id: z.string().optional(),
  errors: z.array(z.looseObject({ code: z.number().optional(), title: z.string().optional() })).optional(),
})
const waValueSchema = z.looseObject({
  messaging_product: z.literal('whatsapp').optional(),
  contacts: z.array(z.looseObject({ wa_id: z.string(), profile: z.looseObject({ name: z.string() }).optional() })).default([]),
  messages: z.array(waMessageSchema).default([]),
  statuses: z.array(waStatusSchema).default([]),
})
export const whatsappWebhookSchema = z.looseObject({
  entry: z.array(z.looseObject({ changes: z.array(z.looseObject({ field: z.string(), value: waValueSchema })).default([]) })).default([]),
})

export type WhatsAppInbound = {
  wamid: string
  waId: string
  profileName: string | null
  at: Date
  kind: string
  body: string | null
  replyToWamid: string | null
  referral: z.infer<typeof waReferralSchema> | null
}
export type WhatsAppStatus = { wamid: string; status: string; at: Date; error: string | null }

/** One POST can carry many messages and statuses across entries; flatten them. */
export function parseWhatsAppWebhook(body: unknown): { messages: WhatsAppInbound[]; statuses: WhatsAppStatus[] } {
  const parsed = whatsappWebhookSchema.safeParse(body)
  if (!parsed.success) return { messages: [], statuses: [] }
  const messages: WhatsAppInbound[] = []
  const statuses: WhatsAppStatus[] = []
  for (const change of parsed.data.entry.flatMap((e) => e.changes)) {
    if (change.field !== 'messages') continue
    const names = new Map(change.value.contacts.map((c) => [c.wa_id, c.profile?.name ?? null]))
    for (const m of change.value.messages) {
      messages.push({
        wamid: m.id,
        waId: m.from,
        profileName: names.get(m.from) ?? null,
        at: new Date(Number(m.timestamp) * 1000),
        kind: m.type,
        body: m.text?.body ?? null,
        replyToWamid: m.context?.id ?? null,
        referral: m.referral ?? null,
      })
    }
    for (const s of change.value.statuses) {
      statuses.push({
        wamid: s.id,
        status: s.status,
        at: new Date(Number(s.timestamp) * 1000),
        error: s.errors?.[0]?.title ?? null,
      })
    }
  }
  return { messages, statuses }
}

/** A first message from a number becomes a lead; CTWA referral data is captured now or never. */
export function mapWhatsAppLead(msg: WhatsAppInbound, fromCampaign: boolean): Partial<LeadIntake> {
  return {
    phone: msg.waId,
    name: msg.profileName ?? undefined,
    source: fromCampaign ? 'whatsapp_campaign' : 'whatsapp_chat',
    ctwa_clid: msg.referral?.ctwa_clid,
    meta_ad_id: msg.referral?.source_type === 'ad' ? msg.referral.source_id : undefined,
    raw_payload: { wamid: msg.wamid, referral: msg.referral, kind: msg.kind },
  } as Partial<LeadIntake>
}

// ---------------------------------------------------------------------------
// Razorpay
// ---------------------------------------------------------------------------
export const razorpayEventSchema = z.looseObject({
  event: z.string(),
  payload: z.looseObject({
    payment: z
      .looseObject({
        entity: z.looseObject({
          id: z.string(),
          amount: z.number(),                    // paise
          status: z.string(),
          method: z.string().optional(),
          created_at: z.number().optional(),
          notes: z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]).optional(),
        }),
      })
      .optional(),
  }),
})

export type RazorpayPayment = {
  invoiceId: string | null
  providerPaymentId: string
  amount: string                               // rupees as a decimal string — never a float
  status: 'created' | 'captured' | 'failed' | 'refunded'
  method: string | null
  capturedAt: string | null
}

const RAZORPAY_STATUS: Record<string, RazorpayPayment['status']> = {
  created: 'created',
  authorized: 'created',
  captured: 'captured',
  failed: 'failed',
  refunded: 'refunded',
}

/** payment.* events → the record_payment() argument. The invoice id travels in payment notes. */
export function mapRazorpayPayment(body: unknown): RazorpayPayment | null {
  const parsed = razorpayEventSchema.safeParse(body)
  const entity = parsed.success ? parsed.data.payload.payment?.entity : undefined
  if (!entity) return null
  const status = RAZORPAY_STATUS[entity.status]
  if (!status) return null
  const notes = entity.notes && !Array.isArray(entity.notes) ? entity.notes : {}
  const paise = BigInt(entity.amount)
  return {
    invoiceId: typeof notes.invoice_id === 'string' ? notes.invoice_id : null,
    providerPaymentId: entity.id,
    amount: `${paise / 100n}.${(paise % 100n).toString().padStart(2, '0')}`,
    status,
    method: entity.method ?? null,
    capturedAt: status === 'captured' && entity.created_at ? new Date(entity.created_at * 1000).toISOString() : null,
  }
}
