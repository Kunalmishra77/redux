import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { leadIntakeSchema } from '@/lib/validators/leads'
import type { Result } from '@/lib/result'

export type IngestOutcome = { leadId: string; created: boolean }

/**
 * The single entry point for a new enquiry from any source (web forms, webhook worker,
 * manual entry). Validates and normalises, then calls ingest_lead(), which dedups (BR-L1),
 * assigns (BR-L4) and starts the SLA clock (BR-L5) atomically in the database.
 *
 * Pass the service-role client for web forms and webhooks, or the user's client for
 * manual entry by a care executive.
 */
export async function ingestLead(
  supabase: SupabaseClient<Database>,
  input: unknown,
): Promise<Result<IngestOutcome>> {
  const parsed = leadIntakeSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      code: 'LEAD_INVALID',
      message: parsed.error.issues[0]?.message ?? 'The enquiry is incomplete',
    }
  }

  const { data, error } = await supabase.rpc('ingest_lead', { p_lead: parsed.data })
  if (error || !data) {
    return { ok: false, code: 'LEAD_INGEST_FAILED', message: 'We could not save this enquiry. Please try again.' }
  }

  const { lead_id, created } = data as { lead_id: string; created: boolean }
  return { ok: true, data: { leadId: lead_id, created } }
}
