// CR-001 phase 10 (D33) — CSV for every report table. RFC 4180 quoting, a BOM so Excel reads ₹ and
// Hindi names as UTF-8, and spreadsheet-formula neutralising: a cell starting with = + - @ (or a tab /
// carriage return) is prefixed with ' so opening the file can never run a formula (CSV injection).

export type CsvColumn = { key: string; label: string }

function cell(v: unknown): string {
  if (v === null || v === undefined) return ''
  let s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: Record<string, unknown>[], columns?: CsvColumn[]): string {
  const cols = columns ?? [...new Set(rows.flatMap((r) => Object.keys(r)))].map((k) => ({ key: k, label: k }))
  const lines = [cols.map((c) => cell(c.label)).join(','), ...rows.map((r) => cols.map((c) => cell(r[c.key])).join(','))]
  return '﻿' + lines.join('\r\n') + '\r\n'
}

/** RFC 4180 reader for the catalog import: quoted fields, "" escapes, CRLF/LF, a leading BOM.
 *  Returns one object per data row keyed by the lower-cased, trimmed header. */
export function parseCsv(text: string): Record<string, string>[] {
  const src = text.replace(/^﻿/, '')
  const rows: string[][] = []
  let row: string[] = [], field = '', quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"' && field === '') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((v) => v !== '')) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some((v) => v !== '')) rows.push(row)
  const [head, ...data] = rows
  if (!head) return []
  const keys = head.map((h) => h.trim().toLowerCase())
  return data.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])))
}
