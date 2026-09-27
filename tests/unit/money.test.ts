import { describe, expect, it } from 'vitest'
import { formatInr, toPaise } from '@/lib/services/money'

describe('toPaise', () => {
  it('parses decimal strings exactly, without float error', () => {
    expect(toPaise('0.1')).toBe(10n)
    expect(toPaise('0.29')).toBe(29n) // 0.29 * 100 = 28.999999999999996 as a float
    expect(toPaise('123456')).toBe(12345600n)
    expect(toPaise('-15.5')).toBe(-1550n)
  })

  it('rounds half away from zero at the third decimal', () => {
    expect(toPaise('1.005')).toBe(101n)
    expect(toPaise('1.004')).toBe(100n)
    expect(toPaise('-1.005')).toBe(-101n)
  })

  it('rejects anything that is not a decimal string', () => {
    expect(() => toPaise('1e5')).toThrow()
    expect(() => toPaise('₹100')).toThrow()
    expect(() => toPaise('')).toThrow()
  })
})

describe('formatInr — Indian digit grouping (CLAUDE.md rule 5)', () => {
  it.each([
    ['0', '₹0'],
    ['999', '₹999'],
    ['1000', '₹1,000'],
    ['123456', '₹1,23,456'],
    ['300000', '₹3,00,000'],
    ['12345678', '₹1,23,45,678'],
    ['1234567890', '₹1,23,45,67,890'],
  ])('%s → %s', (input, expected) => {
    expect(formatInr(input)).toBe(expected)
  })

  it('shows paise only when non-zero by default', () => {
    expect(formatInr('123456.50')).toBe('₹1,23,456.50')
    expect(formatInr('123456.00')).toBe('₹1,23,456')
  })

  it("always shows paise for documents", () => {
    expect(formatInr('50000', 'always')).toBe('₹50,000.00')
  })

  it('rounds to the rupee when asked', () => {
    expect(formatInr('1234.50', 'never')).toBe('₹1,235')
    expect(formatInr('1234.49', 'never')).toBe('₹1,234')
  })

  it('formats negatives (credit notes)', () => {
    expect(formatInr('-6000')).toBe('-₹6,000')
  })
})
