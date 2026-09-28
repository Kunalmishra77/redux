import { describe, expect, it } from 'vitest'
import { bookSurveySchema } from '@/lib/validators/surveys'

const base = {
  lead_id: '11111111-1111-4111-8111-111111111111',
  surveyor_id: '22222222-2222-4222-8222-222222222222',
  scheduled_at: '2026-10-12T11:00:00+05:30',
}

describe('survey booking validation (D4-04, BR-S8)', () => {
  it('accepts an existing property', () => {
    const r = bookSurveySchema.safeParse({ ...base, property: { id: '33333333-3333-4333-8333-333333333333' } })
    expect(r.success).toBe(true)
  })

  it('accepts a new property with an address and a pin', () => {
    const r = bookSurveySchema.safeParse({
      ...base,
      property: { address: '12 Janpath, New Delhi', lat: 28.6139, lng: 77.209 },
    })
    expect(r.success).toBe(true)
  })

  it('BR-S8: rejects a new property without an address', () => {
    const r = bookSurveySchema.safeParse({ ...base, property: { name: 'The Grand Orchid' } })
    expect(r.success).toBe(false)
  })

  it('rejects half a pin', () => {
    const r = bookSurveySchema.safeParse({ ...base, property: { address: '12 Janpath, New Delhi', lat: 28.6 } })
    expect(r.success).toBe(false)
  })

  it('requires a timezone on the slot, so IST is never guessed', () => {
    const r = bookSurveySchema.safeParse({
      ...base,
      scheduled_at: '2026-10-12T11:00:00',
      property: { address: '12 Janpath, New Delhi' },
    })
    expect(r.success).toBe(false)
  })
})
