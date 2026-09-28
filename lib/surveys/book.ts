import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { Result } from '@/lib/result'
import { bookSurveySchema } from '@/lib/validators/surveys'

export type BookedSurvey = { surveyId: string; customerId: string; propertyId: string }

// Postgres error codes raised by book_survey() / ensure_prospect(), mapped to messages for the
// executive who is still on the call.
const MESSAGES: Record<string, { code: string; message: string }> = {
  '23P01': { code: 'SURVEY_SLOT_TAKEN', message: 'That surveyor is already booked in this slot. Pick another surveyor or time.' },
  '42501': { code: 'SURVEY_NOT_ALLOWED', message: 'You can only book surveys for your own leads.' },
  '22023': { code: 'SURVEY_INVALID', message: 'Check the slot, surveyor and address, then try again.' },
  P0002: { code: 'LEAD_NOT_FOUND', message: 'This lead no longer exists.' },
}

/**
 * D4-04: books the free survey from the lead screen. The database does the work atomically —
 * prospect + property (BR-S8), no overlapping slot (BR-S2), lead → survey_booked (BR-L6).
 * Pass the executive's RLS-bound client; permission is checked inside book_survey().
 */
export async function bookSurvey(
  supabase: SupabaseClient<Database>,
  input: unknown,
): Promise<Result<BookedSurvey>> {
  const parsed = bookSurveySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, code: 'SURVEY_INVALID', message: parsed.error.issues[0]?.message ?? 'The booking is incomplete' }
  }

  const { data, error } = await supabase.rpc('book_survey', { p: parsed.data })
  if (error || !data) {
    const mapped = (error?.code && MESSAGES[error.code]) || {
      code: 'SURVEY_BOOKING_FAILED',
      message: 'We could not book this survey. Please try again.',
    }
    return { ok: false, ...mapped }
  }

  const { survey_id, customer_id, property_id } = data as {
    survey_id: string
    customer_id: string
    property_id: string
  }
  return { ok: true, data: { surveyId: survey_id, customerId: customer_id, propertyId: property_id } }
}
