// q_capi: D3-06 — tell Meta a WhatsApp lead became a booked survey or a won job, so the ads
// optimise on outcomes. Shape from research §2 "CAPI": business_messaging, ctwa_clid, WABA id,
// event_time within the last 7 days.

import type { GraphClient } from '@/lib/integrations/meta-graph'
import { GraphError } from '@/lib/integrations/meta-graph'
import type { Db } from '../db'

export type CapiConfig = { datasetId: string; wabaId: string }

type CapiRow = { id: string; event_name: string; ctwa_clid: string | null; value: string | null; currency: string; status: string; created_at: Date }

export async function processCapiEvent(db: Db, graph: GraphClient | null, cfg: CapiConfig | null, eventId: string): Promise<string> {
  const { rows } = await db.query<CapiRow>(
    'select id, event_name, ctwa_clid, value::text, currency, status, created_at from public.capi_events where id = $1 for update', [eventId])
  const ev = rows[0]
  if (!ev || ev.status === 'sent') return 'skipped'

  const fail = async (reason: unknown) => {
    await db.query(`update public.capi_events set status = 'failed', response = $2 where id = $1`, [ev.id, JSON.stringify(reason)])
    return 'failed'
  }
  // Only click-to-WhatsApp leads carry a ctwa_clid; other sources are not attributable this way.
  // (Meta lead-ad CRM conversions keyed on leadgen_id are a separate integration — open item 27.)
  if (!ev.ctwa_clid) return fail({ skipped: 'no ctwa_clid — not a click-to-WhatsApp lead' })
  if (Date.now() - ev.created_at.getTime() > 7 * 24 * 3600 * 1000) return fail({ skipped: 'older than 7 days — Meta rejects it' })
  if (!graph || !cfg) throw new Error('CAPI is not configured (META_CAPI_DATASET_ID / WHATSAPP_BUSINESS_ACCOUNT_ID)')

  try {
    const response = await graph.sendCapiEvent(cfg.datasetId, {
      event_name: ev.event_name,
      event_time: Math.floor(ev.created_at.getTime() / 1000),
      action_source: 'business_messaging',
      messaging_channel: 'whatsapp',
      user_data: { whatsapp_business_account_id: cfg.wabaId, ctwa_clid: ev.ctwa_clid },
      custom_data: ev.value ? { currency: ev.currency, value: ev.value } : undefined,
    })
    await db.query(`update public.capi_events set status = 'sent', sent_at = now(), response = $2 where id = $1`,
      [ev.id, JSON.stringify(response)])
    return 'sent'
  } catch (err) {
    if (err instanceof GraphError && !err.retryable) return fail({ error: err.message, status: err.status })
    throw err                                       // retryable: the queue redelivers after the visibility timeout
  }
}
