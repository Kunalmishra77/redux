import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { consentSchema, leadIntakeSchema } from '@/lib/validators/leads'
import type { Result } from '@/lib/result'

export type IngestOutcome = { leadId: string; created: boolean }

/**
 * The single entry point for a new enquiry from any source (web forms, webhook worker,
 * manual entry). Validates and normalises, then calls ingest_lead(), which dedups (BR-L1),
 * assigns (BR-L4) and starts the SLA clock (BR-L5) atomically in the database.
 *
 * With `consent` (every web and dealer form — D1-06), the lead and its consent records are
 * written in ONE transaction by ingest_lead_with_consent() (D2-11, BR-P1).
 *
 * Pass the service-role client for web forms and webhooks, or the user's client for
 * manual entry by a care executive.
 */
export async function ingestLead(
  supabase: SupabaseClient<Database>,
  input: unknown,
  consent?: unknown,
): Promise<Result<IngestOutcome>> {
  const parsed = leadIntakeSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      code: 'LEAD_INVALID',
      message: parsed.error.issues[0]?.message ?? 'The enquiry is incomplete',
    }
  }

  let rpc
  if (consent === undefined) {
    rpc = await supabase.rpc('ingest_lead', { p_lead: parsed.data })
  } else {
    const parsedConsent = consentSchema.safeParse(consent)
    if (!parsedConsent.success) {
      return { ok: false, code: 'CONSENT_INVALID', message: 'Please confirm how we may contact you.' }
    }
    rpc = await supabase.rpc('ingest_lead_with_consent', { p_lead: parsed.data, p_consent: parsedConsent.data })
  }

  const { data, error } = rpc
  if (error?.code === '23514' && consent !== undefined) {
    // D1-06: the required service-contact box was not ticked
    return { ok: false, code: 'CONSENT_REQUIRED', message: 'Please agree to be contacted about your enquiry.' }
  }
  if (error || !data) {
    return { ok: false, code: 'LEAD_INGEST_FAILED', message: 'We could not save this enquiry. Please try again.' }
  }

  const { lead_id, created } = data as { lead_id: string; created: boolean }
  return { ok: true, data: { leadId: lead_id, created } }
}
