import { z } from 'zod'
import { normalisePhone } from '@/lib/services/phone'

// CR-001 phase 2 — "Create business account" (BR-B2). Shared by the form (field errors) and the
// server action (authoritative check). The database still decides segment, B2C and duplicates.

const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

export const registrationSchema = z.object({
  businessName: z.string().trim().min(2, 'Enter the business or property name').max(200),
  legalName: z.string().trim().max(200).optional().transform((s) => s || undefined),
  segment: z.string().min(1, 'Choose the type of business'),
  sizeUnits: z.union([z.literal(''), z.coerce.number().int().min(0).max(100000)]).optional()
    .transform((v) => (v === '' || v === undefined ? undefined : v)),
  cityId: z.string().optional().transform((s) => s || undefined),
  pincode: z.string().trim().optional().transform((s) => s || undefined)
    .refine((s) => !s || /^[1-9][0-9]{5}$/.test(s), 'Enter a 6-digit pincode'),
  contactName: z.string().trim().min(2, 'Enter your name').max(120),
  roleTitle: z.string().trim().max(80).optional().transform((s) => s || undefined),
  phone: z.string().transform((s, ctx) => {
    const p = normalisePhone(s)
    if (!p || !/^\+91[6-9]\d{9}$/.test(p)) { ctx.addIssue({ code: 'custom', message: 'Enter a 10-digit Indian mobile number' }); return z.NEVER }
    return p
  }),
  email: z.union([z.literal(''), z.email('Enter a valid email')]).optional().transform((s) => s || undefined),
  gstin: z.string().trim().toUpperCase().optional().transform((s) => s || undefined)
    .refine((s) => !s || GSTIN.test(s), 'That GSTIN doesn’t look right'),
  referredBy: z.string().trim().max(200).optional().transform((s) => s || undefined),
  consentService: z.literal(true, { error: 'We need your consent to contact you about this account' }),
  consentMarketing: z.boolean().optional(),
  noticeVersion: z.string().min(1),
})

export type Registration = z.output<typeof registrationSchema>
export type RegistrationInput = z.input<typeof registrationSchema>
