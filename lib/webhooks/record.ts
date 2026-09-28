import 'server-only'

import type { Json } from '@/types/database'
import { createAdminClient } from '@/lib/supabase/admin'
import type { RecordWebhook } from '@/lib/webhooks/handlers'

// record_webhook() is service-role only: it stores the event and queues it on pgmq in one
// transaction (ADR-009). A duplicate delivery is a no-op, so it is not an error.
export const recordWebhook: RecordWebhook = async (source, externalId, eventType, payload, signatureOk) => {
  const { error } = await createAdminClient().rpc('record_webhook', {
    p_source: source,
    p_external_id: externalId,
    p_event_type: eventType ?? '',
    p_payload: payload as Json,
    p_signature_ok: signatureOk,
  })
  if (error) throw new Error(`record_webhook failed: ${error.message}`)
}
