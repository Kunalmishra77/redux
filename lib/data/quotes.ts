import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { QuoteDoc, Supplier } from '@/components/features/quotes/quote-document'

export const QUOTE_DOC_COLUMNS = `id, quote_no, version, status, issued_at, valid_until, subtotal, discount_pct, discount_amount, taxable_value,
  cgst, sgst, igst, total, market_total, you_save, terms_text, warranty_mechanical_days, warranty_finish_days,
  place_of_supply_state_code, survey_id, lead_id, customer_id, supersedes_id, created_at,
  customer:customers(name, gstin, billing_address), property:properties(name, address),
  lines:quotation_lines(id, unit_label, description, qty, unit_price, line_total, price_replace_eurobrass, market_price, gst_rate, hsn_sac, sort_order)`

export async function loadQuote(id: string) {
  const supabase = await createClient()
  const { data } = await supabase.from('quotations').select(QUOTE_DOC_COLUMNS).eq('id', id).maybeSingle()
  if (!data) return null
  const q = data as unknown as Omit<QuoteDoc, 'lines'> & { id: string; survey_id: string; lead_id: string | null; customer_id: string; supersedes_id: string | null; created_at: string; lines: (QuoteDoc['lines'][number] & { sort_order: number })[] }
  q.lines.sort((a, b) => a.sort_order - b.sort_order)
  return q
}

/** Supplier identity for documents — REDUX's GST registration (A11) from settings. */
export async function loadSupplier(): Promise<Supplier> {
  const supabase = await createClient()
  const { data } = await supabase.from('settings').select('key, value').in('key', ['supplier_legal_name', 'supplier_gstin', 'supplier_address'])
  const v = (k: string) => (data?.find((r) => r.key === k)?.value as string | null) ?? '—'
  return { name: v('supplier_legal_name'), gstin: v('supplier_gstin'), address: v('supplier_address') }
}
