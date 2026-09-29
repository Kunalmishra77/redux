import { z } from 'zod'
import type { Enquiry } from '@/lib/validators/enquiry'
import { OTHER_CITY } from '@/lib/validators/enquiry'
import type { Consent, LeadIntake } from '@/lib/validators/leads'

// D1 · E2-S09/S10: a website enquiry becomes a lead intake + a consent record. Pure functions —
// the Server Action does the I/O; the database (ingest_lead_with_consent) does dedup and assignment.

/** Only these attribution keys are kept. Anything else in a URL is noise or an injection attempt. */
const ATTRIBUTION_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'] as const

export type Attribution = {
  params?: Record<string, unknown>
  landingPage?: unknown
  referrer?: unknown
  formPage?: unknown
}

const clip = (v: unknown, max = 200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)

/**
 * BR-L2: the source is first-touch for the lead and every touch keeps its own. The tab the person
 * chose sets it (screen spec A1 §9): a dealer enquiry is source `dealer`; home and hotel are
 * `website`. BR-L3: UTM/click ids are captured here, once, and the database makes them immutable.
 */
export function sourceFor(kind: Enquiry['kind']): 'website' | 'dealer' {
  return kind === 'dealer' ? 'dealer' : 'website'
}

export function sanitiseUtm(params: Record<string, unknown> | undefined): Record<string, string> | undefined {
  if (!params) return undefined
  const out: Record<string, string> = {}
  for (const key of ATTRIBUTION_KEYS) {
    const v = clip(params[key])
    if (v) out[key] = v
  }
  return Object.keys(out).length ? out : undefined
}

/**
 * Maps the validated form onto ingest_lead()'s JSON. BR-L1 dedup happens in the database on the
 * E.164 phone the validator produced, so a repeat enquiry becomes a touch on the open lead.
 * City: a known city goes to city_id (BR-L4 routes by it); "Other" is kept in the payload.
 */
export function toLeadIntake(e: Enquiry, attribution: Attribution = {}): LeadIntake {
  const knownCity = e.city !== OTHER_CITY ? e.city : undefined
  const isHotel = e.kind === 'hotel'
  const isDealer = e.kind === 'dealer'

  const payload: Record<string, string | number | boolean> = { form: 'website_enquiry', kind: e.kind }
  if (e.message) payload.message = e.message
  if (!knownCity && e.cityOther) payload.city_other = e.cityOther
  if (isHotel && e.contactTime) payload.preferred_contact_time = e.contactTime
  if (isDealer && e.firmName) payload.firm_name = e.firmName
  const formPage = clip(attribution.formPage, 300)
  const landingPage = clip(attribution.landingPage, 300)
  const referrer = clip(attribution.referrer, 300)
  if (formPage) payload.form_page = formPage
  if (landingPage) payload.landing_page = landingPage
  if (referrer) payload.referrer = referrer

  return {
    source: sourceFor(e.kind),
    phone: e.phone,
    name: e.name,
    customer_type: e.kind,
    city_id: knownCity,
    // A dealer's firm is the organisation the CRM calls back; a hotel's is the property
    property_name: isHotel ? e.propertyName : isDealer ? e.firmName : undefined,
    unit_count: isHotel ? e.units : undefined,
    enquirer_role: isHotel ? e.role : undefined,
    firm_gstin: isDealer ? e.gstin : undefined,
    utm: sanitiseUtm(attribution.params),
    raw_payload: payload,
  }
}

/**
 * BR-P1: consent is recorded against the notice version the person was shown.
 * BR-P2: service and marketing are separate purposes. D1-06: service is required on web and
 * dealer forms (the database rejects the enquiry without it); marketing defaults to false.
 */
export function toConsent(e: Enquiry, meta: { ip?: string; userAgent?: string } = {}): Consent {
  return {
    notice_version: e.noticeVersion,
    language: 'en',
    method: 'web_form',
    ip_address: meta.ip,
    user_agent: meta.userAgent?.slice(0, 500),
    purposes: { service: e.consentService, marketing: e.consentMarketing === true },
  }
}

/** First address in x-forwarded-for, only if it parses as an IP (the column is inet). */
export function clientIp(forwardedFor: string | null, realIp: string | null): string | undefined {
  const candidate = (forwardedFor?.split(',')[0] ?? realIp ?? '').trim()
  return IP.safeParse(candidate).success ? candidate : undefined
}

const IP = z.union([z.ipv4(), z.ipv6()])
