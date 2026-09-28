import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { calculateYouSave, formatYouSave } from '@/lib/services/pricing'
import { parseCsv, parseRateCardCsv } from '@/lib/services/rate-card-csv'

describe('BR-A4: You save', () => {
  it('is market − recommended', () => {
    expect(calculateYouSave('9000', '1500')).toBe('7500.00')
    expect(formatYouSave('300000', '120000.50')).toBe('You save ₹1,79,999.50')
  })

  it('is hidden (null) — never zero, never negative — when there is no saving', () => {
    expect(calculateYouSave('500', '800')).toBeNull()
    expect(calculateYouSave('800', '800')).toBeNull()
    expect(formatYouSave('500', '800')).toBeNull()
  })
})

describe('parseCsv', () => {
  it('handles quotes, embedded commas, doubled quotes, CRLF and a BOM', () => {
    const text = '﻿a,b\r\n"x, y","say ""hi"""\r\n'
    expect(parseCsv(text)).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
    ])
  })
})

const HEADER = 'fitting_type_code,fitting_type_name,work_type_code,finish_code,price_inr,market_replacement_inr,gst_rate,hsn_sac'

describe('D9-04: rate card CSV import', () => {
  it('reads the blank template REDUX receives and reports every missing price', () => {
    const template = readFileSync('blueprint/data/rate-card-template.csv', 'utf8')
    const result = parseRateCardCsv(template)
    expect(result.rows).toHaveLength(0)
    expect(result.errors.length).toBeGreaterThan(10)
    expect(result.errors[0]).toEqual({ line: 2, message: 'Price is blank' })
  })

  it('accepts a filled-in card', () => {
    const csv = [
      HEADER,
      'basin_mixer,Basin mixer,restore_finish,chrome,1500,9000,18,998719',
      'basin_mixer,Basin mixer,repair_function,,800,9000,18,998719',
      'basin_mixer,Basin mixer,replace_eurobrass,chrome,6000,9000,18,',
    ].join('\n')
    const result = parseRateCardCsv(csv)
    expect(result.errors).toEqual([])
    expect(result.rows).toHaveLength(3)
    expect(result.rows[1]).toMatchObject({ finishCode: null, price: '800', hsnSac: '998719' })
    expect(result.marketPrices).toEqual([
      { fittingTypeCode: 'basin_mixer', finishCode: 'chrome', price: '9000' },
      { fittingTypeCode: 'basin_mixer', finishCode: null, price: '9000' },
    ])
  })

  it('rejects "₹1,500" with a message a person can act on', () => {
    const result = parseRateCardCsv(`${HEADER}\nbasin_mixer,Basin mixer,restore_finish,chrome,"₹1,500",9000,18,`)
    expect(result.errors[0]?.message).toBe('Price "₹1,500" must be a plain number like 1500 or 1500.50')
  })

  it('rejects a duplicate row and a conflicting market price', () => {
    const csv = [
      HEADER,
      'basin_mixer,Basin mixer,restore_finish,chrome,1500,9000,18,',
      'basin_mixer,Basin mixer,restore_finish,chrome,1600,9000,18,',
      'basin_mixer,Basin mixer,replace_eurobrass,chrome,6000,9500,18,',
    ].join('\n')
    const messages = parseRateCardCsv(csv).errors.map((e) => e.message)
    expect(messages).toContain('Duplicate row for basin_mixer / restore_finish / chrome')
    expect(messages.some((m) => m.includes('differs from line 2'))).toBe(true)
  })

  it('BR-A2: flags a fitting type with no market price anywhere', () => {
    const result = parseRateCardCsv(`${HEADER}\naerator,Aerator,replace_eurobrass,,300,,18,`)
    expect(result.errors).toContainEqual({ line: 0, message: 'aerator has no market replacement price on any row' })
  })

  it('rejects an unknown work type and a GST rate over 28', () => {
    const csv = [
      HEADER,
      'basin_mixer,Basin mixer,polish,chrome,1500,9000,18,',
      'basin_mixer,Basin mixer,restore_finish,chrome,1500,9000,40,',
    ].join('\n')
    const messages = parseRateCardCsv(csv).errors.map((e) => e.message)
    expect(messages[0]).toMatch(/Work type "polish"/)
    expect(messages[1]).toMatch(/GST rate "40"/)
  })
})
