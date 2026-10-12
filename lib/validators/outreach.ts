import { z } from 'zod'

// CR-001 phase 9 (D32) — who a campaign goes to. resolve_audience() in the database reads the same
// keys, so the preview and the launch see one definition (BR-C3).
export const audienceSchema = z.object({
  target: z.enum(['leads', 'accounts']),
  tiers: z.array(z.enum(['A', 'B', 'C'])).default([]),
  statuses: z.array(z.string()).default([]),
  lost_reason_ids: z.array(z.uuid()).default([]),
  segments: z.array(z.string()).default([]),
  city_ids: z.array(z.uuid()).default([]),
  inactive_days: z.number().int().min(1).max(3650).nullable().default(null),
  past_customers: z.boolean().default(false),
  referrers: z.boolean().default(false),
})
export type AudienceInput = z.input<typeof audienceSchema>
export type AudiencePreview = { matched: number; eligible: number; no_marketing_consent: number; frequency_cap: number; no_address: number }
