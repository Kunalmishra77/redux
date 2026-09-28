'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser } from '@/lib/auth/session'
import type { Result } from '@/lib/result'

// Invoice actions (D14). The rules live in the database functions: BR-I1 (gapless FY numbering),
// BR-I2 (cancel = credit note), BR-I5 (payments only from the verified webhook), BR-I6 (routing).

const PG_MESSAGES: Record<string, string> = {
  '42501': 'Only the Super Admin can do that.',
  '22023': 'This invoice can’t do that in its current state.',
  '23514': 'Something on this invoice needs attention first.',
  '55000': 'REDUX’s GST details or invoice series aren’t loaded yet (Admin → Settings).',
}
const fail = (e: { code?: string; message: string }) => ({
  ok: false as const, code: e.code ?? 'FAILED',
  message: e.code === '22023' || e.code === '23514' ? e.message.replace(/\s*\((BR|GST|client)[^)]*\)/g, '') : PG_MESSAGES[e.code ?? ''] ?? 'That didn’t work. Try again.',
})

export async function raiseInvoiceAction(jobId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_invoice_from_job', { p_job: jobId })
  if (error) return fail(error)
  revalidatePath('/staff/admin/invoices')
  redirect(`/staff/admin/invoices/${data}`)
}

export async function issueInvoiceAction(id: string): Promise<Result<{ invoiceNo: string }>> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('issue_invoice', { p_invoice: id })
  if (error) return fail(error)
  revalidatePath('/staff/admin/invoices', 'layout')
  return { ok: true, data: { invoiceNo: String(data) } }
}

export async function cancelInvoiceAction(id: string, reason: string): Promise<Result<{ creditNo: string }>> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('cancel_invoice', { p_invoice: id, p_reason: reason })
  if (error) return fail(error)
  revalidatePath('/staff/admin/invoices', 'layout')
  return { ok: true, data: { creditNo: String(data) } }
}

/**
 * DEMO ONLY — stands in for Razorpay: in production a payment is recorded only by the verified
 * webhook (BR-I5). Here the "Pay now" button records a captured UPI payment the way the webhook
 * worker would, through the same record_payment() function.
 */
export async function simulatePaymentAction(invoiceId: string, amount: number): Promise<Result<null>> {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') return { ok: false, code: 'DEMO_ONLY', message: 'Payments come from Razorpay.' }
  const user = await getSessionUser()
  if (!user) return { ok: false, code: 'AUTH', message: 'Sign in again.' }
  // the caller must be able to see the invoice (customer: their own, via RLS)
  const supabase = await createClient()
  const { data: inv } = await supabase.from('invoices').select('id, total, amount_paid, payment_route').eq('id', invoiceId).maybeSingle()
  if (!inv) return { ok: false, code: 'NOT_FOUND', message: 'Invoice not found.' }
  const due = Number(inv.total) - Number(inv.amount_paid)
  if (!(amount > 0) || amount > due + 0.001) return { ok: false, code: 'AMOUNT', message: 'Enter an amount up to the balance due.' }
  const admin = createAdminClient()
  const { error } = await admin.rpc('record_payment', {
    p: {
      invoice_id: invoiceId, provider: 'razorpay', provider_payment_id: `pay_demo_${randomUUID().slice(0, 14)}`,
      method: inv.payment_route === 'virtual_account' ? 'neft' : 'upi', amount: amount.toFixed(2), status: 'captured',
      captured_at: new Date().toISOString(), raw_payload: { demo: true },
    },
  })
  if (error) return fail(error)
  revalidatePath('/portal', 'layout')
  revalidatePath('/staff/admin/invoices', 'layout')
  return { ok: true, data: null }
}
