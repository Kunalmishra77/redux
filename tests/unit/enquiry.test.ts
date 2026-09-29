import { describe, expect, it } from 'vitest'
import { clientIp, sanitiseUtm, sourceFor, toConsent, toLeadIntake } from '@/lib/services/enquiry'
import { enquiryFromFormData, enquirySchema, toIndianMobile } from '@/lib/validators/enquiry'
import { leadIntakeSchema, consentSchema } from '@/lib/validators/leads'

const CITY = '8fd83a96-b0fd-47d8-8991-6eecc28437d0'

const base = {
  kind: 'home' as const,
  name: 'Asha Verma',
  phone: '98100 12345',
  city: CITY,
  consentService: true as const,
  consentMarketing: false,
  noticeVersion: 'v1.0',
}

describe('enquiry form validation (A13/A14)', () => {
  it('normalises an Indian mobile to E.164 (BR-L1)', () => {
    expect(toIndianMobile('98100 12345')).toBe('+919810012345')
    expect(toIndianMobile('+91-98100-12345')).toBe('+919810012345')
    expect(toIndianMobile('09810012345')).toBe('+919810012345')
    expect(toIndianMobile('12345')).toBeNull()
    expect(toIndianMobile('1234567890')).toBeNull() // not a mobile series
    expect(toIndianMobile('+14155550100')).toBeNull()
  })

  it('shows the microcopy phone error', () => {
    const r = enquirySchema.safeParse({ ...base, phone: '123' })
    expect(r.success).toBe(false)
    expect(r.error?.issues.find((i) => i.path[0] === 'phone')?.message).toBe('Enter a 10-digit mobile number.')
  })

  it('requires service consent (D1-06) and leaves marketing optional', () => {
    const noService = enquirySchema.safeParse({ ...base, consentService: false })
    expect(noService.success).toBe(false)
    expect(enquirySchema.safeParse(base).success).toBe(true)
  })

  it('requires the property name for hotels and the firm name for dealers', () => {
    const hotel = enquirySchema.safeParse({ ...base, kind: 'hotel' })
    expect(hotel.error?.issues.map((i) => i.path[0])).toContain('propertyName')
    const dealer = enquirySchema.safeParse({ ...base, kind: 'dealer' })
    expect(dealer.error?.issues.map((i) => i.path[0])).toContain('firmName')
  })

  it('asks for the city name when "another city" is chosen', () => {
    const r = enquirySchema.safeParse({ ...base, city: 'other' })
    expect(r.error?.issues.map((i) => i.path[0])).toContain('cityOther')
  })

  it('reads checkboxes from FormData — unticked marketing stays false', () => {
    const fd = new FormData()
    for (const [k, v] of Object.entries({ kind: 'home', name: 'A B', phone: '9810012345', city: CITY, noticeVersion: 'v1.0' })) fd.set(k, v)
    fd.set('consentService', 'on')
    const input = enquiryFromFormData(fd)
    expect(input.consentService).toBe(true)
    expect(input.consentMarketing).toBe(false)
  })
})

describe('enquiry → lead intake + consent (E2-S09/S10)', () => {
  it('sets the source from the tab: dealer → dealer, home/hotel → website (BR-L2)', () => {
    expect(sourceFor('dealer')).toBe('dealer')
    expect(sourceFor('hotel')).toBe('website')
    expect(sourceFor('home')).toBe('website')
  })

  it('maps a hotel enquiry onto ingest_lead() fields', () => {
    const e = enquirySchema.parse({ ...base, kind: 'hotel', propertyName: 'The Grand', units: '120', role: 'Chief Engineer', message: 'Leaks' })
    const lead = toLeadIntake(e, { params: { utm_source: 'google', evil: 'x' }, formPage: '/hotels' })
    expect(leadIntakeSchema.safeParse(lead).success).toBe(true)
    expect(lead).toMatchObject({
      source: 'website',
      phone: '+919810012345',
      customer_type: 'hotel',
      city_id: CITY,
      property_name: 'The Grand',
      unit_count: 120,
      enquirer_role: 'Chief Engineer',
      utm: { utm_source: 'google' },
    })
    expect(lead.raw_payload).toMatchObject({ message: 'Leaks', form_page: '/hotels' })
  })

  it('keeps an unknown city in the payload, never as city_id', () => {
    const e = enquirySchema.parse({ ...base, city: 'other', cityOther: 'Lucknow' })
    const lead = toLeadIntake(e)
    expect(lead.city_id).toBeUndefined()
    expect(lead.raw_payload).toMatchObject({ city_other: 'Lucknow' })
  })

  it('drops hotel fields from a home enquiry', () => {
    const e = enquirySchema.parse({ ...base, propertyName: 'ignored', units: '5' })
    const lead = toLeadIntake(e)
    expect(lead.property_name).toBeUndefined()
    expect(lead.unit_count).toBeUndefined()
  })

  it('records service + marketing as separate purposes against the notice shown (BR-P1/P2)', () => {
    const e = enquirySchema.parse(base)
    const c = toConsent(e, { ip: '203.0.113.9', userAgent: 'x' })
    expect(consentSchema.safeParse(c).success).toBe(true)
    expect(c).toMatchObject({ notice_version: 'v1.0', method: 'web_form', purposes: { service: true, marketing: false } })
  })

  it('allow-lists attribution keys and clips values (BR-L3)', () => {
    expect(sanitiseUtm({ utm_campaign: 'a'.repeat(500), foo: 'bar', gclid: 'g' })).toEqual({
      utm_campaign: 'a'.repeat(200),
      gclid: 'g',
    })
    expect(sanitiseUtm({ foo: 'bar' })).toBeUndefined()
  })

  it('keeps only a parseable client IP (the column is inet)', () => {
    expect(clientIp('203.0.113.9, 10.0.0.1', null)).toBe('203.0.113.9')
    expect(clientIp(null, '::1')).toBe('::1')
    expect(clientIp('not-an-ip', null)).toBeUndefined()
    expect(clientIp(null, null)).toBeUndefined()
  })
})
