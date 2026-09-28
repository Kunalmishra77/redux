import { z } from 'zod'
import { normalisePhone } from '@/lib/services/phone'

// The eight source codes seeded in migration 000400 (lead_sources). D3 counts call + walk-in
// as one "manual" source, which is why the contract says seven.
export const LEAD_SOURCES = [
  'website',
  'dealer',
  'meta_lead_ad',
  'whatsapp_chat',
  'whatsapp_campaign',
  'google_ads',
  'call',
  'walk_in',
] as const

const optionalText = z.string().trim().min(1).max(200).optional()

// Shape accepted by the ingest_lead() RPC. Phone arrives in any spelling and leaves as E.164.
export const leadIntakeSchema = z.object({
  phone: z
    .string()
    .transform((raw, ctx) => {
      const e164 = normalisePhone(raw)
      if (!e164) {
        ctx.addIssue({ code: 'custom', message: 'Enter a valid mobile number' })
        return z.NEVER
      }
      return e164
    }),
  source: z.enum(LEAD_SOURCES),
  name: optionalText,
  email: z.email().optional(),
  city_id: z.uuid().optional(),
  customer_type: z.enum(['home', 'hotel', 'dealer', 'other']).optional(),
  property_name: optionalText,
  unit_count: z.number().int().positive().max(5000).optional(),
  enquirer_role: optionalText,
  firm_gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'Enter a valid GSTIN')
    .optional(),
  // Attribution — BR-L3: written once, at creation
  campaign_id: z.uuid().optional(),
  meta_ad_id: optionalText,
  meta_form_id: optionalText,
  meta_leadgen_id: optionalText,
  google_lead_id: optionalText,
  ctwa_clid: optionalText,
  utm: z.record(z.string(), z.string()).optional(),
  raw_payload: z.json().optional(),
})

export type LeadIntake = z.infer<typeof leadIntakeSchema>

// BR-P1/P2 · D1-06: consent captured with the enquiry — one flag per purpose, against the notice
// version the person was actually shown. Marketing is optional and must default to false.
export const CONSENT_PURPOSES = ['service', 'marketing', 'call_recording', 'photo_marketing'] as const

export const consentSchema = z.object({
  notice_version: z.string().trim().min(1),
  language: z.string().trim().min(2).max(5).optional(),
  method: z.enum(['web_form', 'whatsapp', 'verbal_call', 'portal', 'staff_entry']),
  ip_address: z.union([z.ipv4(), z.ipv6()]).optional(),
  user_agent: z.string().max(500).optional(),
  purposes: z.partialRecord(z.enum(CONSENT_PURPOSES), z.boolean()).refine((p) => Object.keys(p).length > 0, {
    message: 'Record at least one consent purpose',
  }),
})

export type Consent = z.infer<typeof consentSchema>
