// q_webhooks: turn stored webhook events into leads, chat messages and payments.
// Runs inside the caller's transaction; throwing rolls every write back.

import {
  extractLeadgenIds,
  googleLeadSchema,
  mapGoogleLead,
  mapMetaLead,
  mapRazorpayPayment,
  mapWhatsAppLead,
  metaLeadSchema,
  parseWhatsAppWebhook,
  type WhatsAppInbound,
} from '@/lib/integrations/payloads'
import type { GraphClient } from '@/lib/integrations/meta-graph'
import { leadIntakeSchema } from '@/lib/validators/leads'
import { PermanentError, type Db } from '../db'

type WebhookRow = { id: string; source: string; event_type: string | null; payload: unknown; status: string }

async function fieldMap(db: Db, provider: 'meta' | 'google_ads', formId: string | undefined): Promise<Record<string, string>> {
  if (!formId) return {}
  const { rows } = await db.query<{ field_name: string; maps_to: string }>(
    'select field_name, maps_to from public.lead_form_field_map where provider = $1 and form_id = $2',
    [provider, formId],
  )
  return Object.fromEntries(rows.map((r) => [r.field_name, r.maps_to]))
}

/** BR-L1…L5 all happen inside ingest_lead(); here we only normalise and validate. */
async function ingest(db: Db, intake: unknown): Promise<string> {
  const parsed = leadIntakeSchema.safeParse(intake)
  if (!parsed.success) {
    throw new PermanentError(`Lead rejected: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`)
  }
  const { rows } = await db.query<{ r: { lead_id: string } }>('select public.ingest_lead($1::jsonb) as r', [JSON.stringify(parsed.data)])
  return rows[0]!.r.lead_id
}

async function processGoogle(db: Db, payload: unknown): Promise<void> {
  const lead = googleLeadSchema.safeParse(payload)
  if (!lead.success) throw new PermanentError('Not a Google Ads lead payload')
  if (lead.data.is_test) return                      // "Send test data": verified, then dropped
  await ingest(db, mapGoogleLead(lead.data, await fieldMap(db, 'google_ads', lead.data.form_id?.toString())))
}

async function ingestMetaLead(db: Db, raw: unknown): Promise<void> {
  const lead = metaLeadSchema.safeParse(raw)
  if (!lead.success) throw new PermanentError('Graph API returned an unexpected lead shape')
  await ingest(db, mapMetaLead(lead.data, await fieldMap(db, 'meta', lead.data.form_id)))
}

async function processMetaLeadgen(db: Db, graph: GraphClient, payload: unknown): Promise<void> {
  for (const leadgenId of extractLeadgenIds(payload)) {
    await ingestMetaLead(db, await graph.getLead(leadgenId))
  }
}

// Status only moves forward: sent → delivered → read (failed can arrive at any point)
const STATUS_RANK = "case $2 when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 when 'failed' then 4 else 0 end"
const CURRENT_RANK = (col: string) => `case ${col} when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 when 'failed' then 4 else 0 end`

async function processWhatsAppInbound(db: Db, msg: WhatsAppInbound): Promise<void> {
  const { rows } = await db.query<{ id: string; lead_id: string | null }>(
    `insert into public.whatsapp_conversations
       (wa_id, profile_name, referral_source_id, referral_source_type, ctwa_clid, window_expires_at, last_message_at)
     values ($1, $2, $3, $4, $5, $6::timestamptz + interval '24 hours', $6)
     on conflict (wa_id) do update set
       profile_name      = coalesce(excluded.profile_name, public.whatsapp_conversations.profile_name),
       window_expires_at = greatest(public.whatsapp_conversations.window_expires_at, excluded.window_expires_at),
       last_message_at   = greatest(public.whatsapp_conversations.last_message_at, excluded.last_message_at)
     returning id, lead_id`,
    [msg.waId, msg.profileName, msg.referral?.source_id ?? null, msg.referral?.source_type ?? null,
     msg.referral?.ctwa_clid ?? null, msg.at.toISOString()],
  )
  const conversation = rows[0]!

  const inserted = await db.query(
    `insert into public.whatsapp_messages (conversation_id, wamid, direction, kind, body, occurred_at)
     values ($1, $2, 'inbound', $3, $4, $5) on conflict (wamid) do nothing`,
    [conversation.id, msg.wamid, msg.kind, msg.body, msg.at.toISOString()],
  )
  if (inserted.rowCount === 0 || conversation.lead_id) return   // redelivery, or already a lead

  // First message from this number: it is an enquiry. A reply to one of our templates is a campaign lead.
  const fromCampaign = msg.replyToWamid
    ? (await db.query(`select 1 from public.whatsapp_messages where wamid = $1 and direction = 'outbound' and kind = 'template'`, [msg.replyToWamid])).rowCount! > 0
    : false
  const leadId = await ingest(db, mapWhatsAppLead(msg, fromCampaign))
  await db.query('update public.whatsapp_conversations set lead_id = $2 where id = $1 and lead_id is null', [conversation.id, leadId])
}

async function processWhatsApp(db: Db, payload: unknown): Promise<void> {
  const { messages, statuses } = parseWhatsAppWebhook(payload)
  for (const msg of messages) await processWhatsAppInbound(db, msg)
  for (const s of statuses.filter((x) => ['sent', 'delivered', 'read', 'failed'].includes(x.status))) {
    await db.query(
      `update public.whatsapp_messages set status = $2
       where wamid = $1 and direction = 'outbound' and ${STATUS_RANK} > ${CURRENT_RANK('status')}`,
      [s.wamid, s.status],
    )
    await db.query(
      `update public.messages set
         status = $2::public.msg_status,
         delivered_at = case when $2 in ('delivered','read') then coalesce(delivered_at, $3::timestamptz) else delivered_at end,
         error = coalesce($4, error)
       where provider_message_id = $1 and ${STATUS_RANK} > ${CURRENT_RANK('status::text')}`,
      [s.wamid, s.status, s.at.toISOString(), s.error],
    )
  }
}

async function processRazorpay(db: Db, payload: unknown): Promise<void> {
  const payment = mapRazorpayPayment(payload)
  if (!payment) return                                // settlements etc.: acknowledged, nothing to apply
  if (!payment.invoiceId) throw new PermanentError(`Payment ${payment.providerPaymentId} carries no invoice_id note`)
  // BR-I5/I7: paid only from this verified event, idempotent on the payment id
  await db.query('select public.record_payment($1::jsonb)', [JSON.stringify({
    invoice_id: payment.invoiceId,
    provider_payment_id: payment.providerPaymentId,
    amount: payment.amount,
    status: payment.status,
    method: payment.method,
    captured_at: payment.capturedAt,
    raw_payload: payload,
  })])
}

export async function processWebhookEvent(db: Db, graph: GraphClient | null, eventId: string): Promise<void> {
  const { rows } = await db.query<WebhookRow>(
    'select id, source, event_type, payload, status from public.webhook_events where id = $1 for update', [eventId])
  const event = rows[0]
  if (!event || event.status === 'done' || event.status === 'dead') return

  switch (event.source) {
    case 'google_ads': await processGoogle(db, event.payload); break
    case 'whatsapp':   await processWhatsApp(db, event.payload); break
    case 'razorpay':   await processRazorpay(db, event.payload); break
    case 'meta_leadgen':
      if (!graph) throw new Error('META_SYSTEM_USER_TOKEN is not set — cannot fetch Meta leads')
      await processMetaLeadgen(db, graph, event.payload)
      break
    default: throw new PermanentError(`Unknown webhook source ${event.source}`)
  }
  await db.query('select public.webhook_processed($1)', [event.id])
}

/** D3-04: the 15-minute poll that closes any webhook gap before Meta's 90-day deletion. */
export async function reconcileMetaLeads(db: Db, graph: GraphClient, sinceIso: string): Promise<number> {
  const { rows } = await db.query<{ form_id: string }>(
    `select distinct jsonb_array_elements_text(config -> 'form_ids') as form_id
     from public.integration_accounts where provider = 'meta' and is_active`)
  const since = Math.floor(new Date(sinceIso).getTime() / 1000)
  let seen = 0
  for (const { form_id } of rows) {
    for (const lead of await graph.listFormLeads(form_id, since)) {
      await ingestMetaLead(db, lead)                  // ingest_lead() dedups on meta_leadgen_id
      seen++
    }
  }
  return seen
}

/** A failure that will never succeed: dead-letter now (with the TN5 alert) instead of retrying. */
export async function deadLetter(db: Db, eventId: string, reason: string): Promise<void> {
  await db.query(
    `update public.webhook_events set status = 'dead', last_error = left($2, 2000), retry_count = retry_count + 1 where id = $1`,
    [eventId, reason])
  await db.query(
    `select public.notify_team('TN5', 'Webhook could not be processed', left($2, 300), 'webhook_events', $1::uuid, 'dead:' || $1)`,
    [eventId, reason])
}
