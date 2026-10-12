import { describe, expect, it } from 'vitest'
import { parseCsv, toCsv } from '@/lib/services/csv'

// CR-001 phase 10 (D33) — report exports
describe('toCsv', () => {
  it('writes a header and rows, with a BOM for Excel', () => {
    const out = toCsv([{ tier: 'A', leads: 3 }], [{ key: 'tier', label: 'Tier' }, { key: 'leads', label: 'Leads' }])
    expect(out).toBe('﻿Tier,Leads\r\nA,3\r\n')
  })
  it('quotes commas, quotes and new lines', () => {
    expect(toCsv([{ a: 'Hotel "Aurum", Delhi' }])).toContain('"Hotel ""Aurum"", Delhi"')
    expect(toCsv([{ a: 'line1\nline2' }])).toContain('"line1\nline2"')
  })
  it('neutralises formulas but keeps negative numbers', () => {
    expect(toCsv([{ a: '=HYPERLINK("x")' }])).toContain(`"'=HYPERLINK(""x"")"`)
    expect(toCsv([{ a: '@SUM(A1)' }])).toContain("'@SUM(A1)")
    expect(toCsv([{ a: '-250' }])).toContain('\r\n-250\r\n')
  })
  it('leaves empty values empty', () => {
    expect(toCsv([{ a: null, b: undefined }], [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }])).toBe('﻿A,B\r\n,\r\n')
  })
})

describe('parseCsv', () => {
  it('reads headers, quoted commas, escaped quotes and CRLF', () => {
    const rows = parseCsv('﻿SKU,Name,Benefits\r\nEB-1,"Mixer, single lever","Says ""quiet""|Fast"\r\n\r\nEB-2,Spout,\n')
    expect(rows).toEqual([
      { sku: 'EB-1', name: 'Mixer, single lever', benefits: 'Says "quiet"|Fast' },
      { sku: 'EB-2', name: 'Spout', benefits: '' },
    ])
  })
  it('round-trips what toCsv writes', () => {
    const out = toCsv([{ a: 'x, "y"', b: 'line\nbreak' }])
    expect(parseCsv(out)).toEqual([{ a: 'x, "y"', b: 'line\nbreak' }])
  })
})
