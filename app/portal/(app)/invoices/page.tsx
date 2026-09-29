import type { Metadata } from 'next'
import Link from 'next/link'
import { Receipt } from 'lucide-react'
import { formatWhen, Money, StatusPill } from '@/components/patterns'
import { createClient } from '@/lib/supabase/server'
import { requirePortalUser } from '@/lib/data/portal'
import { INVOICE_STATUS } from '@/lib/constants/statuses'
import { PayButton } from './pay-button'

export const metadata: Metadata = { title: 'Invoices' }

// D6s — invoices and payment.
export default async function PortalInvoices() {
  await requirePortalUser()
  const supabase = await createClient()
  const { data } = await supabase.from('invoices').select('id, invoice_no, status, issue_date, total, amount_paid, payment_route').order('issue_date', { ascending: false })
  const rows = data ?? []
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-ink">Invoices</h1>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted-ink"><Receipt className="mx-auto mb-2 size-6 text-redux-blue" aria-hidden />Your invoice appears here when the work is handed over.</div>
      ) : (
        <ul className="space-y-3">
          {rows.map((i) => {
            const st = INVOICE_STATUS[i.status]!
            const due = Number(i.total) - Number(i.amount_paid)
            return (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-4 shadow-card">
                <Link href={`/portal/invoices/${i.id}`} className="min-w-0">
                  <p className="num font-semibold text-ink">{i.invoice_no}</p>
                  <p className="text-sm text-muted-ink">{i.issue_date ? formatWhen(i.issue_date, false) : ''} · <Money value={i.total} paise="never" /></p>
                </Link>
                <div className="flex items-center gap-3">
                  <StatusPill tone={st.tone}>{st.label}</StatusPill>
                  {due > 0 && (i.status === 'issued' || i.status === 'part_paid') && <PayButton invoiceId={i.id} due={due} route={i.payment_route} />}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
