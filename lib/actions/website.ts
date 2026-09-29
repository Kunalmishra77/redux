'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { ingestLead } from '@/lib/leads/ingest'
import { clientIp, toConsent, toLeadIntake, type Attribution } from '@/lib/services/enquiry'
import { enquirySchema, fieldErrors } from '@/lib/validators/enquiry'
import type { Database } from '@/types/database'

// D1 · E2-S09/S10/S15 — the public enquiry form (A13 home/hotel, A14 dealer).
// The website has no session, so the lead is written with the service role through
// ingest_lead_with_consent(): the lead (BR-L1 dedup, BR-L4 assignment, BR-L5 SLA) and its consent
// records (BR-P1/P2) in one transaction. Messages are for a member of the public: never a DB error.

export type EnquiryState =
  | { ok: false; code: string; message: string; fields?: Record<string, string> }
  | null

export async function submitEnquiryAction(
  input: unknown,
  attribution: Attribution = {},
  honeypot = '',
): Promise<EnquiryState> {
  // E2-S15: a filled honeypot is a bot. Answer exactly as for a real enquiry so it learns nothing.
  if (honeypot.trim() !== '') redirect('/thank-you')

  const parsed = enquirySchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      code: 'ENQUIRY_INVALID',
      message: 'Please check the highlighted fields.',
      fields: fieldErrors(parsed.error),
    }
  }

  const h = await headers()
  const meta = {
    ip: clientIp(h.get('x-forwarded-for'), h.get('x-real-ip')),
    userAgent: h.get('user-agent') ?? undefined,
  }

  let result
  try {
    result = await ingestLead(
      createAdminClient() as unknown as SupabaseClient<Database>,
      toLeadIntake(parsed.data, attribution),
      toConsent(parsed.data, meta),
    )
  } catch {
    result = { ok: false as const, code: 'LEAD_INGEST_FAILED', message: '' }
  }

  if (!result.ok) {
    if (result.code === 'CONSENT_REQUIRED' || result.code === 'CONSENT_INVALID') {
      return {
        ok: false,
        code: result.code,
        message: 'Please agree to be contacted about your enquiry.',
        fields: { consentService: 'Please agree to be contacted about your enquiry.' },
      }
    }
    return {
      ok: false,
      code: 'ENQUIRY_FAILED',
      message: 'We could not send your enquiry just now. Please try again, or message us on WhatsApp.',
    }
  }

  redirect('/thank-you')
}
