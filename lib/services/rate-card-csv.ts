// D9-04: REDUX fills in blueprint/data/rate-card-template.csv; this parses and validates it before
// anything touches the database. It catches the mistakes a filled-in spreadsheet actually has:
// blank prices, "₹1,500" instead of 1500, the same row twice, two market prices for one fitting.
// Pure: no framework imports, so the admin import screen and any script share it.

import { toPaise } from '@/lib/services/money'

export const RATE_CARD_COLUMNS = [
  'fitting_type_code',
  'fitting_type_name',
  'work_type_code',
  'finish_code',
  'price_inr',
  'market_replacement_inr',
  'gst_rate',
  'hsn_sac',
] as const

export const WORK_TYPE_CODES = ['restore_finish', 'repair_function', 'replace_eurobrass'] as const

export type RateCardRow = {
  line: number
  fittingTypeCode: string
  fittingTypeName: string
  workTypeCode: (typeof WORK_TYPE_CODES)[number]
  finishCode: string | null
  price: string
  gstRate: string
  hsnSac: string | null
}

export type MarketPriceRow = { fittingTypeCode: string; finishCode: string | null; price: string }

export type RateCardParseResult = {
  rows: RateCardRow[]
  marketPrices: MarketPriceRow[]
  errors: { line: number; message: string }[]
}

/** RFC 4180 CSV: quoted fields, doubled quotes, commas and newlines inside quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const records: string[][] = []
  let field = ''
  let record: string[] = []
  let inQuotes = false
  const src = text.replace(/^﻿/, '') // Excel's BOM

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      record.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      record.push(field)
      records.push(record)
      record = []
      field = ''
    } else {
      field += ch
    }
  }
  if (field !== '' || record.length > 0) {
    record.push(field)
    records.push(record)
  }
  return records.filter((r) => r.some((cell) => cell.trim() !== ''))
}

const MONEY = /^\d{1,10}(\.\d{1,2})?$/

function money(raw: string): string | null {
  const cleaned = raw.trim()
  return MONEY.test(cleaned) ? cleaned : null
}

export function parseRateCardCsv(text: string): RateCardParseResult {
  const errors: RateCardParseResult['errors'] = []
  const [header, ...body] = parseCsv(text)

  const cols = (header ?? []).map((h) => h.trim().toLowerCase())
  const missing = RATE_CARD_COLUMNS.filter((c) => !cols.includes(c))
  if (missing.length > 0) {
    return { rows: [], marketPrices: [], errors: [{ line: 1, message: `Missing column(s): ${missing.join(', ')}` }] }
  }
  const at = (record: string[], name: (typeof RATE_CARD_COLUMNS)[number]) =>
    (record[cols.indexOf(name)] ?? '').trim()

  const rows: RateCardRow[] = []
  const seen = new Set<string>()
  const market = new Map<string, MarketPriceRow & { line: number }>()

  body.forEach((record, index) => {
    const line = index + 2
    const fittingTypeCode = at(record, 'fitting_type_code')
    const workTypeCode = at(record, 'work_type_code')
    const finishCode = at(record, 'finish_code') || null
    const rawPrice = at(record, 'price_inr')
    const rawMarket = at(record, 'market_replacement_inr')
    const rawGst = at(record, 'gst_rate') || '18'

    if (!/^[a-z0-9_]+$/.test(fittingTypeCode)) {
      errors.push({ line, message: `Fitting type code "${fittingTypeCode}" must be lower_snake_case` })
      return
    }
    if (!(WORK_TYPE_CODES as readonly string[]).includes(workTypeCode)) {
      errors.push({ line, message: `Work type "${workTypeCode}" must be one of ${WORK_TYPE_CODES.join(', ')}` })
      return
    }
    const price = money(rawPrice)
    if (price === null) {
      errors.push({
        line,
        message: rawPrice === '' ? 'Price is blank' : `Price "${rawPrice}" must be a plain number like 1500 or 1500.50`,
      })
      return
    }
    const gstRate = money(rawGst)
    if (gstRate === null || toPaise(gstRate) > 2800n) {
      errors.push({ line, message: `GST rate "${rawGst}" must be a number between 0 and 28` })
      return
    }

    const key = `${fittingTypeCode}|${workTypeCode}|${finishCode ?? ''}`
    if (seen.has(key)) {
      errors.push({ line, message: `Duplicate row for ${fittingTypeCode} / ${workTypeCode} / ${finishCode ?? 'any finish'}` })
      return
    }
    seen.add(key)

    rows.push({
      line,
      fittingTypeCode,
      fittingTypeName: at(record, 'fitting_type_name') || fittingTypeCode,
      workTypeCode: workTypeCode as RateCardRow['workTypeCode'],
      finishCode,
      price,
      gstRate,
      hsnSac: at(record, 'hsn_sac') || null,
    })

    // Market replacement price: per fitting type + finish; the same pair must agree across rows
    if (rawMarket !== '') {
      const marketPrice = money(rawMarket)
      if (marketPrice === null) {
        errors.push({ line, message: `Market price "${rawMarket}" must be a plain number` })
        return
      }
      const marketKey = `${fittingTypeCode}|${finishCode ?? ''}`
      const existing = market.get(marketKey)
      if (existing && toPaise(existing.price) !== toPaise(marketPrice)) {
        errors.push({
          line,
          message: `Market price ${marketPrice} for ${fittingTypeCode} / ${finishCode ?? 'any finish'} differs from line ${existing.line} (${existing.price})`,
        })
        return
      }
      market.set(marketKey, { fittingTypeCode, finishCode, price: marketPrice, line })
    }
  })

  // BR-A2: every fitting type needs a market price, or "You save" can never be shown
  for (const code of new Set(rows.map((r) => r.fittingTypeCode))) {
    if (![...market.values()].some((m) => m.fittingTypeCode === code)) {
      errors.push({ line: 0, message: `${code} has no market replacement price on any row` })
    }
  }

  const marketPrices = [...market.values()].map(({ fittingTypeCode, finishCode, price }) => ({
    fittingTypeCode,
    finishCode,
    price,
  }))
  return { rows, marketPrices, errors }
}
