// ADR-008: verify the raw body → persist → answer fast. The work happens in the queue worker.
// These functions hold each provider's contract and take the persistence step as an argument, so
// they are unit-tested without HTTP or a database. The route files only adapt Request/Response.

import {
  sha256Hex,
  verifyGoogleKey,
  verifyMetaSignature,
  verifyRazorpaySignature,
  safeEqual,
} from '@/lib/integrations/signature'

export type WebhookSource = 'meta_leadgen' | 'whatsapp' | 'google_ads' | 'razorpay'

/** Persists one event (record_webhook). Throws if the database is unreachable. */
export type RecordWebhook = (
  source: WebhookSource,
  externalId: string,
  eventType: string | null,
  payload: unknown,
  signatureOk: boolean,
) => Promise<void>

export type WebhookReply = { status: number; body: string; contentType: string }

const text = (status: number, body = ''): WebhookReply => ({ status, body, contentType: 'text/plain' })
const json = (status: number, body: unknown): WebhookReply => ({ status, body: JSON.stringify(body), contentType: 'application/json' })

function parse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return { unparseable_body: raw.slice(0, 10_000) }
  }
}

/** Meta and WhatsApp share the subscription handshake: echo hub.challenge when the token matches. */
export function handleMetaVerification(params: URLSearchParams, verifyToken: string): WebhookReply {
  const token = params.get('hub.verify_token') ?? ''
  if (params.get('hub.mode') === 'subscribe' && verifyToken && safeEqual(token, verifyToken)) {
    return text(200, params.get('hub.challenge') ?? '')
  }
  return text(403)
}

/**
 * Meta lead ads and WhatsApp. A bad signature is not Meta: refuse it, store nothing. A database
 * failure answers 5XX so Meta redelivers (it disables the subscription only after sustained failure).
 * One POST may batch several changes, so the idempotency key is the hash of the raw body (item 7);
 * leads themselves dedup on meta_leadgen_id, messages on wamid.
 */
export async function handleMetaPost(
  source: 'meta_leadgen' | 'whatsapp',
  raw: string,
  signature: string | null,
  appSecret: string,
  record: RecordWebhook,
): Promise<WebhookReply> {
  if (!verifyMetaSignature(raw, signature, appSecret)) return text(401)
  try {
    await record(source, sha256Hex(raw), source === 'meta_leadgen' ? 'leadgen' : 'messages', parse(raw), true)
  } catch {
    return text(500)
  }
  return text(200, 'EVENT_RECEIVED')
}

/**
 * Google Ads lead forms. The contract: 200 with body {} — and NEVER a 4XX, because Google does not
 * retry a 4XX and the lead is lost forever. A wrong key is still answered 200 and kept, unprocessed,
 * for audit. Only a database failure answers 5XX, which Google does retry.
 */
export async function handleGoogleAds(raw: string, expectedKey: string, record: RecordWebhook): Promise<WebhookReply> {
  const payload = parse(raw)
  const fields = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>
  const keyOk = verifyGoogleKey(fields.google_key, expectedKey)
  const leadId = typeof fields.lead_id === 'string' && fields.lead_id ? fields.lead_id : null
  // the shared secret never reaches the database
  const stored = Object.fromEntries(Object.entries(fields).filter(([k]) => k !== 'google_key'))
  try {
    await record('google_ads', leadId ?? sha256Hex(raw), 'lead', stored, keyOk)
  } catch {
    return json(500, {})
  }
  return json(200, {})
}

/** Razorpay: keyed on X-Razorpay-Event-Id, so authorized and captured for one payment are two events. */
export async function handleRazorpay(
  raw: string,
  signature: string | null,
  eventId: string | null,
  secret: string,
  record: RecordWebhook,
): Promise<WebhookReply> {
  if (!verifyRazorpaySignature(raw, signature, secret)) return text(401)
  const payload = parse(raw)
  const event = payload && typeof payload === 'object' && 'event' in payload ? String((payload as { event: unknown }).event) : null
  try {
    await record('razorpay', eventId || sha256Hex(raw), event, payload, true)
  } catch {
    return text(500)
  }
  return text(200, 'OK')
}

export function toResponse(reply: WebhookReply): Response {
  return new Response(reply.body, { status: reply.status, headers: { 'content-type': reply.contentType } })
}
