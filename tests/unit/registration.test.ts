import { describe, expect, it } from 'vitest'
import { registrationSchema } from '@/lib/validators/registration'

// CR-001 phase 2 — "Create business account" form rules (BR-B2; consent BR-P1).
const base = {
  businessName: 'Hotel Saffron Court', segment: 'hotel', contactName: 'Ritu Anand', phone: '98100 22031',
  consentService: true as const, noticeVersion: 'v1.0',
}

describe('registrationSchema', () => {
  it('accepts the minimum and normalises the phone to E.164', () => {
    const r = registrationSchema.parse(base)
    expect(r.phone).toBe('+919810022031')
    expect(r.sizeUnits).toBeUndefined()
  })
  it('requires service consent', () => {
    expect(registrationSchema.safeParse({ ...base, consentService: false }).success).toBe(false)
  })
  it('rejects a landline or foreign number', () => {
    expect(registrationSchema.safeParse({ ...base, phone: '011 4000 0000' }).success).toBe(false)
    expect(registrationSchema.safeParse({ ...base, phone: '+44 7700 900123' }).success).toBe(false)
  })
  it('validates GSTIN and pincode only when given', () => {
    expect(registrationSchema.safeParse({ ...base, gstin: '07AAACE1234F1Z5', pincode: '110001' }).success).toBe(true)
    expect(registrationSchema.safeParse({ ...base, gstin: 'NOTAGSTIN' }).success).toBe(false)
    expect(registrationSchema.safeParse({ ...base, pincode: '01234' }).success).toBe(false)
  })
  it('reads the room count as a number and blank as absent', () => {
    expect(registrationSchema.parse({ ...base, sizeUnits: '36' }).sizeUnits).toBe(36)
    expect(registrationSchema.parse({ ...base, sizeUnits: '' }).sizeUnits).toBeUndefined()
  })
  it('upper-cases a GSTIN typed in lower case', () => {
    expect(registrationSchema.parse({ ...base, gstin: '07aaace1234f1z5' }).gstin).toBe('07AAACE1234F1Z5')
  })
})
