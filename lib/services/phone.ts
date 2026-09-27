// BR-L1: a lead is identified by its phone number normalised to E.164. Every source must pass
// through this before ingest_lead(), or "98100 00001", "+91-9810000001" and WhatsApp's
// "919810000001" become three different people.

const E164 = /^\+[1-9]\d{7,14}$/

/**
 * Normalises an Indian-context phone number to E.164, or returns null if it cannot be one.
 * Accepts: +91 98100 00001 · 09810000001 · 9810000001 · 919810000001 (WhatsApp wa_id) ·
 * 0091 9810000001 · other countries in +CC… or 00CC… form.
 */
export function normalisePhone(raw: string): string | null {
  const trimmed = raw.trim()
  const hasPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')

  let e164: string
  if (hasPlus) {
    e164 = `+${digits}`
  } else if (digits.startsWith('00')) {
    e164 = `+${digits.slice(2)}`
  } else if (digits.length === 10) {
    e164 = `+91${digits}`
  } else if (digits.length === 11 && digits.startsWith('0')) {
    e164 = `+91${digits.slice(1)}`
  } else if (digits.length === 12 && digits.startsWith('91')) {
    e164 = `+${digits}`
  } else {
    return null
  }

  if (!E164.test(e164)) return null
  // An Indian number is always 10 national digits
  if (e164.startsWith('+91') && e164.length !== 13) return null
  return e164
}
