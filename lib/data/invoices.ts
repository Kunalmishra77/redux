import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { InvoiceDoc } from '@/components/features/invoices/invoice-document'

export const INVOICE_DOC_COLUMNS = `id, invoice_no, status, issue_date, due_date, supply_date, supplier_gstin, supplier_name, supplier_address,
  supplier_state_code, recipient_gstin, recipient_name, recipient_address, place_of_supply_state_code, reverse_charge,
  subtotal, discount_amount, taxable_value, cgst, sgst, igst, total, amount_paid, payment_route, payment_link_url,
  virtual_account_details, cancelled_at, job_id, customer_id, created_at,
  job:jobs(job_no), lines:invoice_lines(id, description, hsn_sac, qty, uom, unit_price, taxable_value, gst_rate, line_total, sort_order)`

export type LoadedInvoice = Omit<InvoiceDoc, 'lines'> & {
  id: string; job_id: string | null; customer_id: string; created_at: string; cancelled_at: string | null
  payment_link_url: string | null; virtual_account_details: Record<string, string> | null; job: { job_no: string } | null
  lines: (InvoiceDoc['lines'][number] & { sort_order: number })[]
}

export async function loadInvoice(id: string): Promise<LoadedInvoice | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('invoices').select(INVOICE_DOC_COLUMNS).eq('id', id).maybeSingle()
  if (!data) return null
  const inv = data as unknown as LoadedInvoice
  inv.lines.sort((a, b) => a.sort_order - b.sort_order)
  return inv
}
