import { z } from 'zod'
import { normalisePhone } from '@/lib/services/phone'

// A13 / A14 — the public enquiry form (home · hotel · dealer). One schema, shared by the browser
// (inline validation on blur) and the Server Action (the check that counts). Messages are the
// microcopy in blueprint/05-content/01-website-copy.md.

export const ENQUIRER_KINDS = ['home', 'hotel', 'dealer'] as const
export type EnquirerKind = (typeof ENQUIRER_KINDS)[number]

export const HOTEL_ROLES = [
  'Chief Engineer',
  'Maintenance Head',
  'General Manager',
  'Purchase / Procurement',
  'Owner / Director',
  'Other',
] as const

export const CONTACT_TIMES = ['Any time', 'Morning (10–1)', 'Afternoon (1–4)', 'Evening (4–6:30)'] as const

export const OTHER_CITY = 'other'

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .optional()
    .transform((v) => (v ? v : undefined))

/** Indian mobile: 10 digits starting 6–9, after stripping +91 / 0 / spaces. */
export function toIndianMobile(raw: string): string | null {
  const e164 = normalisePhone(raw)
  if (!e164 || !/^\+91[6-9]\d{9}$/.test(e164)) return null
  return e164
}

export const enquirySchema = z
  .object({
    kind: z.enum(ENQUIRER_KINDS, { error: 'Tell us who the enquiry is for.' }),
    name: z.string().trim().min(2, 'Enter your name.').max(100, 'Keep your name under 100 characters.'),
    phone: z.string().transform((raw, ctx) => {
      const e164 = toIndianMobile(raw)
      if (!e164) {
        ctx.addIssue({ code: 'custom', message: 'Enter a 10-digit mobile number.' })
        return z.NEVER
      }
      return e164
    }),
    city: z.string().trim().min(1, 'Choose your city.'),
    cityOther: optional(80),
    propertyName: optional(150),
    units: z
      .string()
      .trim()
      .optional()
      .transform((v, ctx) => {
        if (!v) return undefined
        const n = Number(v)
        if (!Number.isInteger(n) || n < 1 || n > 5000) {
          ctx.addIssue({ code: 'custom', message: 'Enter a number of rooms between 1 and 5,000.' })
          return z.NEVER
        }
        return n
      }),
    role: z.enum(HOTEL_ROLES).optional().or(z.literal('').transform(() => undefined)),
    contactTime: z.enum(CONTACT_TIMES).optional().or(z.literal('').transform(() => undefined)),
    firmName: optional(150),
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .optional()
      .transform((v, ctx) => {
        if (!v) return undefined
        if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v)) {
          ctx.addIssue({ code: 'custom', message: 'Enter a valid 15-character GSTIN, or leave it blank.' })
          return z.NEVER
        }
        return v
      }),
    message: optional(1000),
    // D1-06: required; marketing is optional and unticked by default (DPDP)
    consentService: z.literal(true, { error: 'Please agree to be contacted about your enquiry.' }),
    consentMarketing: z.boolean(),
    noticeVersion: z.string().trim().min(1, 'The privacy notice could not be loaded. Refresh the page and try again.'),
  })
  .superRefine((v, ctx) => {
    if (v.city === OTHER_CITY && !v.cityOther) {
      ctx.addIssue({ code: 'custom', path: ['cityOther'], message: 'Enter your city.' })
    }
    if (v.kind === 'hotel' && !v.propertyName) {
      ctx.addIssue({ code: 'custom', path: ['propertyName'], message: 'Enter the property name.' })
    }
    if (v.kind === 'dealer' && !v.firmName) {
      ctx.addIssue({ code: 'custom', path: ['firmName'], message: 'Enter your firm name.' })
    }
  })

export type EnquiryInput = z.input<typeof enquirySchema>
export type Enquiry = z.output<typeof enquirySchema>

/** The shape the browser sends. Checkboxes arrive as "on" or absent. */
export function enquiryFromFormData(fd: FormData): EnquiryInput {
  const s = (k: string) => {
    const v = fd.get(k)
    return typeof v === 'string' ? v : undefined
  }
  return {
    kind: (s('kind') ?? '') as EnquirerKind,
    name: s('name') ?? '',
    phone: s('phone') ?? '',
    city: s('city') ?? '',
    cityOther: s('cityOther'),
    propertyName: s('propertyName'),
    units: s('units'),
    role: s('role') as EnquiryInput['role'],
    contactTime: s('contactTime') as EnquiryInput['contactTime'],
    firmName: s('firmName'),
    gstin: s('gstin'),
    message: s('message'),
    consentService: (s('consentService') === 'on') as true,
    consentMarketing: s('consentMarketing') === 'on',
    noticeVersion: s('noticeVersion') ?? '',
  }
}

/** First error per field, for inline messages. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_form')
    if (!out[key]) out[key] = issue.message
  }
  return out
}
