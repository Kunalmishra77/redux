import type { Metadata } from 'next'
import Link from 'next/link'
import { FileText } from 'lucide-react'
import { EmptyState, formatWhen, Money, PageHeader, StatusPill } from '@/components/patterns'
import { QUOTE_STATUS } from '@/lib/constants/statuses'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { nowMs } from '@/lib/services/clock'

export const metadata: Metadata = { title: 'Quotes' }

type Row = { id: string; quote_no: string; version: number; status: string; total: string; you_save: string; valid_until: string | null; created_at: string
  customer: { name: string } | null; property: { name: string } | null }

// B18 — surveyors see their own (RLS); an executive sees the quotes of their own leads.
export default async function QuotesPage() {
  const user = await requireRole(['super_admin', 'surveyor', 'cc_exec'])
  const supabase = await createClient()
  const { data } = await supabase.from('quotations')
    .select('id, quote_no, version, status, total, you_save, valid_until, created_at, customer:customers(name), property:properties(name)')
    .order('created_at', { ascending: false })
  const rows = (data ?? []) as unknown as Row[]
  const live = rows.filter((r) => r.status !== 'superseded')
  const today = new Date().toISOString().slice(0, 10)
  return (
    <>
      <PageHeader title={user.role === 'surveyor' ? 'My quotes' : 'Quotes'} description="Built from the survey audit — restore, repair and replace priced side by side." />
      {live.length === 0 ? (
        <EmptyState icon={FileText} title="No quotations yet" body="Open a submitted survey and choose “Create quotation”." action={<Link href="/staff/surveys" className="text-sm font-semibold text-redux-blue hover:underline">Go to surveys →</Link>} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-white shadow-card">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line bg-surface text-left">
              {['Quotation', 'Customer', 'Total incl. GST', 'You save', 'Valid until', 'Status'].map((h, i) => <th key={h} className={`eyebrow px-4 py-3 text-muted-ink ${i === 2 || i === 3 ? 'text-right' : ''}`}>{h}</th>)}
            </tr></thead>
            <tbody>
              {live.map((q) => {
                const st = QUOTE_STATUS[q.status]!
                const expiringSoon = q.status === 'sent' && q.valid_until && q.valid_until <= new Date(nowMs() + 3 * 86_400_000).toISOString().slice(0, 10)
                return (
                  <tr key={q.id} className="border-b border-line last:border-0 hover:bg-select">
                    <td className="px-4 py-3"><Link href={`/staff/quotes/${q.id}`} className="num font-semibold text-ink hover:text-redux-blue">{q.quote_no} v{q.version}</Link>
                      <p className="text-xs text-muted-ink">{formatWhen(q.created_at, false)}</p></td>
                    <td className="px-4 py-3"><p className="font-medium text-ink">{q.customer?.name}</p><p className="text-xs text-muted-ink">{q.property?.name}</p></td>
                    <td className="px-4 py-3 text-right font-semibold"><Money value={q.total} paise="never" /></td>
                    <td className="px-4 py-3 text-right text-success"><Money value={q.you_save} paise="never" /></td>
                    <td className={`num px-4 py-3 ${expiringSoon ? 'font-semibold text-warning' : 'text-muted-ink'}`}>{q.valid_until && q.valid_until >= today ? formatWhen(q.valid_until, false) : q.valid_until ? 'Lapsed' : '—'}</td>
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
