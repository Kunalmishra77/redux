// q_notifications: send one queued customer message (CN*). Notifications matrix delivery rules:
// quiet hours already set send_after; 3 attempts with backoff, then failed and surfaced; a marketing
// message needs live marketing consent (BR-P2); a template must be approved before it is used.

import type { GraphClient } from '@/lib/integrations/meta-graph'
import { GraphError } from '@/lib/integrations/meta-graph'
import { PermanentError, sendMessage, type Db } from '../db'

type MessageRow = {
  id: string
  channel: string
  category: string | null
  to_address: string
  lead_id: string | null
  customer_id: string | null
  template_code: string | null
  variables: Record<string, unknown>
  status: string
  attempts: number
  send_after: Date
  tpl_name: string | null
  tpl_language: string | null
  tpl_variables: string[] | null
  tpl_approved: boolean | null
}

export type WhatsAppConfig = { phoneNumberId: string }

/** Ordered body parameters from the template's declared variable names. */
export function templateParams(declared: string[] | null, values: Record<string, unknown>): string[] {
  return (declared ?? []).map((name) => {
    const v = values[name]
    return v === null || v === undefined ? '' : String(v)
  })
}

export async function processNotification(
  db: Db,
  graph: GraphClient | null,
  wa: WhatsAppConfig | null,
  messageId: string,
): Promise<'sent' | 'skipped' | 'retry' | 'failed'> {
  const { rows } = await db.query<MessageRow>(
    `select m.id, m.channel, m.category, m.to_address, m.lead_id, m.customer_id, m.template_code, m.variables,
            m.status, m.attempts, m.send_after,
            t.provider_template_name as tpl_name, t.language as tpl_language,
            (select array_agg(v) from jsonb_array_elements_text(t.variables) v) as tpl_variables,
            (t.approved_at is not null and t.is_active) as tpl_approved
     from public.messages m left join public.message_templates t on t.code = m.template_code
     where m.id = $1 for update of m`,
    [messageId],
  )
  const msg = rows[0]
  if (!msg || !['queued', 'failed'].includes(msg.status)) return 'skipped'
  if (msg.send_after > new Date()) {
    // quiet hours: come back exactly when the window opens (the caller deletes this delivery)
    await sendMessage(db, 'q_notifications', { message_id: msg.id },
      Math.ceil((msg.send_after.getTime() - Date.now()) / 1000))
    return 'retry'
  }

  const { rows: maxRows } = await db.query<{ n: number }>(
    `select coalesce((select (value #>> '{}')::int from public.settings where key = 'notification_max_attempts'), 3) as n`)
  const maxAttempts = maxRows[0]!.n

  try {
    if (msg.category === 'marketing') {
      const { rows: c } = await db.query<{ ok: boolean }>('select public.has_consent($1, $2, $3) as ok',
        [msg.to_address, msg.customer_id, 'marketing'])
      if (!c[0]?.ok) throw new PermanentError('No live marketing consent (BR-P2)')
    }
    if (msg.channel !== 'whatsapp') throw new PermanentError(`Channel ${msg.channel} has no sender configured yet`)
    if (!graph || !wa) throw new Error('WhatsApp is not configured (META_SYSTEM_USER_TOKEN / WHATSAPP_PHONE_NUMBER_ID)')
    if (!msg.tpl_approved || !msg.tpl_name) {
      throw new PermanentError(`Template ${msg.template_code ?? '(none)'} is not approved on Meta yet (E5-S05)`)
    }

    const to = msg.to_address.replace(/^\+/, '')
    const wamid = await graph.sendTemplate(wa.phoneNumberId, to, msg.tpl_name, msg.tpl_language ?? 'en',
      templateParams(msg.tpl_variables, msg.variables))

    await db.query(
      `update public.messages set status = 'sent', sent_at = now(), provider_message_id = $2, attempts = attempts + 1, error = null
       where id = $1`, [msg.id, wamid])
    // the outbound template also appears in the executive's inbox thread (D4-08)
    await db.query(
      `with c as (
         insert into public.whatsapp_conversations (wa_id, lead_id, customer_id)
         values ($1, $2, $3)
         on conflict (wa_id) do update set lead_id = coalesce(public.whatsapp_conversations.lead_id, excluded.lead_id)
         returning id)
       insert into public.whatsapp_messages (conversation_id, wamid, direction, kind, template_code, status)
       select id, $4, 'outbound', 'template', $5, 'sent' from c
       on conflict (wamid) do nothing`,
      [to, msg.lead_id, msg.customer_id, wamid, msg.template_code])
    return 'sent'
  } catch (err) {
    const permanent = err instanceof PermanentError || (err instanceof GraphError && !err.retryable)
    const attempts = msg.attempts + 1
    const giveUp = permanent || attempts >= maxAttempts
    await db.query(
      `update public.messages set attempts = $2, error = left($3, 2000), status = $4::public.msg_status where id = $1`,
      [msg.id, attempts, err instanceof Error ? err.message : String(err), giveUp ? 'failed' : 'queued'])
    if (!giveUp) {
      // backoff: 1 min, 4 min, 16 min …
      await sendMessage(db, 'q_notifications', { message_id: msg.id }, 60 * 4 ** (attempts - 1))
      return 'retry'
    }
    return 'failed'
  }
}
