import { describe, expect, it } from 'vitest'
import { normalisePhone } from '@/lib/services/phone'

describe('BR-L1: phone normalisation to E.164', () => {
  it.each([
    ['+91 98100 00001', '+919810000001'],
    ['+91-9810-000001', '+919810000001'],
    ['9810000001', '+919810000001'],
    ['09810000001', '+919810000001'],
    ['919810000001', '+919810000001'], // WhatsApp wa_id
    ['0091 9810000001', '+919810000001'],
    ['(011) 2345 6789', '+911123456789'], // Delhi landline with STD 0 — hotels give these
    ['+44 20 7946 0958', '+442079460958'],
  ])('%s → %s', (input, expected) => {
    expect(normalisePhone(input)).toBe(expected)
  })

  it('treats every spelling of the same number as one identity', () => {
    const spellings = ['+91 98100 00001', '9810000001', '919810000001', '09810000001']
    expect(new Set(spellings.map(normalisePhone)).size).toBe(1)
  })

  it.each([
    ['', 'empty'],
    ['12345', 'too short'],
    ['+91 98100 0000', 'Indian number with 9 digits'],
    ['+91 98100 000011', 'Indian number with 11 digits'],
    ['98100000011234', 'ambiguous 14 digits without a country code'],
    ['+0 123 456 789', 'country code cannot start with 0'],
  ])('rejects %s (%s)', (input) => {
    expect(normalisePhone(input)).toBeNull()
  })
})
