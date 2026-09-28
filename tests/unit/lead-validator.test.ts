import { describe, expect, it } from 'vitest'
import { consentSchema, leadIntakeSchema } from '@/lib/validators/leads'

describe('lead intake validation', () => {
  it('BR-L1: normalises the phone to E.164 before it reaches the database', () => {
    const parsed = leadIntakeSchema.parse({ phone: '98100 00001', source: 'website' })
    expect(parsed.phone).toBe('+919810000001')
  })

  it('rejects an unusable phone with a message for the person, not the database', () => {
    const result = leadIntakeSchema.safeParse({ phone: '12345', source: 'website' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Enter a valid mobile number')
  })

  it('rejects a source that is not one of the eight seeded codes', () => {
    expect(leadIntakeSchema.safeParse({ phone: '9810000001', source: 'instagram' }).success).toBe(false)
  })

  it('accepts a dealer GSTIN in any case and rejects a malformed one (D1-04)', () => {
    const ok = leadIntakeSchema.parse({ phone: '9810000001', source: 'dealer', firm_gstin: '07aaacr5055k1z5' })
    expect(ok.firm_gstin).toBe('07AAACR5055K1Z5')
    expect(
      leadIntakeSchema.safeParse({ phone: '9810000001', source: 'dealer', firm_gstin: 'NOT-A-GSTIN' }).success,
    ).toBe(false)
  })
})

describe('consent captured with the enquiry (BR-P1/P2, D1-06)', () => {
  it('accepts one flag per purpose against a notice version', () => {
    const r = consentSchema.safeParse({
      notice_version: 'v1.0',
      method: 'web_form',
      ip_address: '198.51.100.4',
      purposes: { service: true, marketing: false },
    })
    expect(r.success).toBe(true)
  })

  it('rejects an empty purpose set and an unknown purpose', () => {
    expect(consentSchema.safeParse({ notice_version: 'v1.0', method: 'web_form', purposes: {} }).success).toBe(false)
    expect(
      consentSchema.safeParse({ notice_version: 'v1.0', method: 'web_form', purposes: { newsletter: true } }).success,
    ).toBe(false)
  })

  it('rejects consent that does not say which notice was shown', () => {
    expect(consentSchema.safeParse({ method: 'web_form', purposes: { service: true } }).success).toBe(false)
  })
})
