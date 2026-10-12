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
