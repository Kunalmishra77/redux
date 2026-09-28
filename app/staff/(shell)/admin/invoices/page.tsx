import type { Metadata } from 'next'
import Link from 'next/link'
import { AlarmClock, Receipt } from 'lucide-react'
import { EmptyState, formatWhen, Kpi, Money, PageHeader, Panel, StatusPill } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { INVOICE_STATUS } from '@/lib/constants/statuses'
import { RaiseInvoiceButton } from './raise-button'

export const metadata: Metadata = { title: 'Invoices' }

type Row = { id: string; invoice_no: string | null; status: string; issue_date: string | null; total: number; amount_paid: number; payment_route: string | null
  recipient_name: string; job: { job_no: string } | null }

// B33 — invoices, with the jobs that are finished but not yet invoiced (GST: within 30 days of supply).
export default async function InvoicesPage() {
  await requireRole(['super_admin', 'cc_exec'])
  const supabase = await createClient()
  const [{ data }, { data: due }, { data: uninvoiced }] = await Promise.all([
    supabase.from('invoices').select('id, invoice_no, status, issue_date, total, amount_paid, payment_route, recipient_name, job:jobs(job_no)').order('created_at', { ascending: false }),
    supabase.from('v_invoices_due').select('job_id, job_no, days_since_supply'),
    supabase.from('jobs').select('id, job_no, actual_end, customer:customers(name), invoices(id, status)').eq('status', 'completed'),
  ])
  const rows = (data ?? []) as unknown as Row[]
  const waiting = ((uninvoiced ?? []) as unknown as { id: string; job_no: string; actual_end: string | null; customer: { name: string } | null; invoices: { status: string }[] }[])
    .filter((j) => !j.invoices.some((i) => i.status !== 'cancelled'))
  const live = rows.filter((r) => r.status === 'issued' || r.status === 'part_paid')
  const outstanding = live.reduce((s, r) => s + Number(r.total) - Number(r.amount_paid), 0)
  const collected = rows.reduce((s, r) => s + Number(r.amount_paid), 0)
  return (
    <>
      <PageHeader eyebrow="Admin" title="Invoices" description="GST tax invoices, raised from finished jobs. Numbers are gapless per financial year." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Kpi label="Outstanding" value={<Money value={outstanding.toFixed(2)} paise="never" />} hint={`${live.length} open invoice${live.length === 1 ? '' : 's'}`} />
        <Kpi label="Collected" value={<Money value={collected.toFixed(2)} paise="never" />} hint="All time" />
        <Kpi label="Jobs to invoice" value={waiting.length} hint={due?.length ? `${due.length} near the 30-day GST limit` : 'None near the GST limit'} />
      </div>

      {waiting.length > 0 && (
        <Panel title="Finished jobs waiting for an invoice" className="mb-6" bodyClassName="p-0">
          <ul className="divide-y divide-line">
            {waiting.map((j) => {
              const late = due?.find((d) => d.job_id === j.id)
              return (
                <li key={j.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div>
                    <Link href={`/staff/jobs/${j.id}`} className="num font-semibold text-ink hover:text-redux-blue">{j.job_no}</Link>
                    <span className="text-muted-ink"> · {j.customer?.name}{j.actual_end ? ` · finished ${formatWhen(j.actual_end, false)}` : ''}</span>
                    {late && <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-warning"><AlarmClock className="size-3.5" aria-hidden /> {late.days_since_supply} days since supply</span>}
                  </div>
                  <RaiseInvoiceButton jobId={j.id} />
                </li>
              )
            })}
          </ul>
        </Panel>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={Receipt} title="No invoices yet" body="Raise the first one from a finished job above." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-white shadow-card">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line bg-surface text-left">
              {['Invoice', 'Customer', 'Total', 'Paid', 'Collect by', 'Status'].map((h, i) => <th key={h} className={`eyebrow px-4 py-3 text-muted-ink ${i === 2 || i === 3 ? 'text-right' : ''}`}>{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.map((r) => {
                const st = INVOICE_STATUS[r.status]!
                return (
                  <tr key={r.id} className="border-b border-line last:border-0 hover:bg-select">
                    <td className="px-4 py-3"><Link href={`/staff/admin/invoices/${r.id}`} className="num font-semibold text-ink hover:text-redux-blue">{r.invoice_no ?? 'Draft'}</Link>
                      <p className="text-xs text-muted-ink">{r.job?.job_no}{r.issue_date ? ` · ${formatWhen(r.issue_date, false)}` : ''}</p></td>
                    <td className="px-4 py-3 text-ink">{r.recipient_name}</td>
                    <td className="px-4 py-3 text-right font-semibold"><Money value={r.total} paise="never" /></td>
                    <td className="px-4 py-3 text-right text-muted-ink"><Money value={r.amount_paid} paise="never" /></td>
                    <td className="px-4 py-3 text-xs text-muted-ink">{r.payment_route === 'virtual_account' ? 'Bank transfer (NEFT/RTGS)' : r.payment_route === 'payment_link' ? 'Payment link (UPI/card)' : '—'}</td>
                    <td className="px-4 py-3"><StatusPill tone={st.tone}>{st.label}</StatusPill></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
