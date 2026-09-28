import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Building2, Link2 } from 'lucide-react'
import { formatWhen, Money, Panel, StatusPill } from '@/components/patterns'
import { InvoiceDocument } from '@/components/features/invoices/invoice-document'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { INVOICE_STATUS } from '@/lib/constants/statuses'
import { loadInvoice } from '@/lib/data/invoices'
import { loadSupplier } from '@/lib/data/quotes'
import { InvoiceActions } from './invoice-actions'

export const metadata: Metadata = { title: 'Invoice' }

// B33 detail — the document itself, its payments and credit notes.
export default async function InvoicePage({ params }: PageProps<'/staff/admin/invoices/[id]'>) {
  const user = await requireRole(['super_admin', 'cc_exec'])
  const { id } = await params
  const [inv, supplier] = await Promise.all([loadInvoice(id), loadSupplier()])
  if (!inv) notFound()
  const supabase = await createClient()
  const [{ data: payments }, { data: credits }] = await Promise.all([
    supabase.from('payments').select('id, provider_payment_id, method, amount, status, captured_at, created_at').eq('invoice_id', id).order('created_at', { ascending: false }),
    supabase.from('credit_notes').select('id, credit_no, reason, amount, issue_date').eq('invoice_id', id),
  ])
  const st = INVOICE_STATUS[inv.status]!
  const va = inv.virtual_account_details
  return (
    <>
      <Link href="/staff/admin/invoices" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-redux-blue hover:underline"><ArrowLeft className="size-4" aria-hidden /> Invoices</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-redux-blue">Tax invoice</p>
          <h1 className="num mt-1 text-[28px] leading-tight font-semibold text-ink">{inv.invoice_no ?? 'Draft invoice'}</h1>
          <p className="mt-1 text-sm text-muted-ink">{inv.recipient_name}{inv.job ? <> · <Link href={`/staff/jobs/${inv.job_id}`} className="hover:text-redux-blue">{inv.job.job_no}</Link></> : null}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={st.tone}>{st.label}</StatusPill>
          {user.role === 'super_admin' && <InvoiceActions id={id} status={inv.status} />}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="overflow-x-auto rounded-lg bg-surface p-2"><InvoiceDocument inv={inv} fallbackSupplier={supplier} /></div>
        <div className="space-y-5">
          {inv.status !== 'draft' && inv.status !== 'cancelled' && (
            <Panel title="How the customer pays" action={inv.payment_route === 'virtual_account' ? <Building2 className="size-4 text-redux-blue" aria-hidden /> : <Link2 className="size-4 text-redux-blue" aria-hidden />}>
              {inv.payment_route === 'virtual_account' ? (
                <div className="space-y-1 text-sm">
                  <p className="text-muted-ink">Above the card limit, so it’s routed to a dedicated bank account — no 2% card fee on a large invoice.</p>
                  {va && <dl className="mt-2 space-y-1 rounded-md bg-surface p-3 text-xs">{Object.entries(va).map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-muted-ink">{k.replace(/_/g, ' ')}</dt><dd className="num text-ink">{v}</dd></div>)}</dl>}
                </div>
              ) : (
                <p className="text-sm text-muted-ink">A Razorpay payment link (UPI, card, netbanking) — sent on WhatsApp and shown in the customer’s portal.</p>
              )}
            </Panel>
          )}
          <Panel title="Payments">
            {payments?.length ? (
              <ul className="divide-y divide-line text-sm">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div><p className="font-medium text-ink uppercase">{p.method ?? 'payment'}</p><p className="num text-xs text-faint">{p.provider_payment_id}</p></div>
                    <div className="text-right"><p className="font-semibold"><Money value={p.amount} paise="never" /></p><p className="text-xs text-muted-ink">{p.status === 'captured' ? formatWhen(p.captured_at ?? p.created_at) : p.status}</p></div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-ink">No payments yet. They arrive from Razorpay and reconcile here automatically.</p>}
          </Panel>
          {(credits?.length ?? 0) > 0 && (
            <Panel title="Credit notes">
              <ul className="space-y-2 text-sm">{credits!.map((c) => <li key={c.id}><p className="num font-semibold">{c.credit_no} · <Money value={c.amount} paise="never" /></p><p className="text-xs text-muted-ink">{c.reason} · {formatWhen(c.issue_date, false)}</p></li>)}</ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  )
}
