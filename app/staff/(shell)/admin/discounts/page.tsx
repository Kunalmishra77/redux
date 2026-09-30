import type { Metadata } from 'next'
import Link from 'next/link'
import { BadgePercent } from 'lucide-react'
import { EmptyState, formatRelative, Money, PageHeader, Panel } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { DecideButtons } from './decide-buttons'

export const metadata: Metadata = { title: 'Discount approvals' }

type Pending = { id: string; requested_pct: string; reason: string; requested_at: string
  requester: { full_name: string } | null
  quote: { id: string; quote_no: string; version: number; subtotal: string; total: string; customer: { name: string } | null } | null }

// B21 — BR-A6: a discount above the threshold waits here; the quote can't be sent until decided.
export default async function DiscountsPage() {
  await requireRole(['super_admin'])
  const supabase = await createClient()
  const [{ data }, { data: decided }] = await Promise.all([
    supabase.from('discount_approvals')
      .select('id, requested_pct, reason, requested_at, requester:profiles!discount_approvals_requested_by_fkey(full_name), quote:quotations(id, quote_no, version, subtotal, total, customer:customers(name))')
      .is('decision', null).order('requested_at'),
    supabase.from('discount_approvals')
      .select('id, requested_pct, decision, decision_note, decided_at, quote:quotations(id, quote_no, version)')
      .not('decision', 'is', null).order('decided_at', { ascending: false }).limit(10),
  ])
  const pending = (data ?? []) as unknown as Pending[]
  const history = (decided ?? []) as unknown as { id: string; requested_pct: string; decision: string; decision_note: string | null; decided_at: string; quote: { id: string; quote_no: string; version: number } | null }[]
  return (
    <>
      <PageHeader back={{ href: '/staff/admin', label: 'Admin' }} title="Discount approvals" description="Discounts above the threshold wait for you. The quote can’t be sent until you decide." />
      {pending.length === 0 ? (
        <EmptyState icon={BadgePercent} title="Nothing waiting" body="Every discount request has been decided." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {pending.map((p) => {
            const off = (Number(p.quote?.subtotal ?? 0) * Number(p.requested_pct)) / 100
            return (
              <Panel key={p.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/staff/quotes/${p.quote?.id}`} className="num font-semibold text-ink hover:text-redux-blue">{p.quote?.quote_no} v{p.quote?.version}</Link>
                    <p className="text-sm text-muted-ink">{p.quote?.customer?.name}</p>
                  </div>
                  <p className="num text-3xl font-semibold text-redux-blue">{Number(p.requested_pct)}%</p>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="eyebrow text-muted-ink">Subtotal</dt><dd><Money value={p.quote?.subtotal} paise="never" /></dd></div>
                  <div><dt className="eyebrow text-muted-ink">Discount value</dt><dd className="text-danger">−<Money value={off.toFixed(2)} paise="never" /></dd></div>
                </dl>
                <blockquote className="mt-4 rounded-md bg-surface px-3 py-2 text-sm text-ink">“{p.reason}”
                  <footer className="mt-1 text-xs text-muted-ink">— {p.requester?.full_name}, {formatRelative(p.requested_at)}</footer></blockquote>
                <DecideButtons approvalId={p.id} />
              </Panel>
            )
          })}
        </div>
      )}
      {history.length > 0 && (
        <Panel title="Recently decided" className="mt-8">
          <ul className="divide-y divide-line text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={`/staff/quotes/${h.quote?.id}`} className="num font-medium text-ink hover:text-redux-blue">{h.quote?.quote_no} v{h.quote?.version} · {Number(h.requested_pct)}%</Link>
                <span className="text-xs text-muted-ink">{h.decision_note}</span>
                <span className={h.decision === 'approved' ? 'text-success' : 'text-danger'}>{h.decision === 'approved' ? 'Approved' : 'Rejected'} · {formatRelative(h.decided_at)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  )
}
