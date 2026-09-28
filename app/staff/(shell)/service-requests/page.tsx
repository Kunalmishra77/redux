import type { Metadata } from 'next'
import Link from 'next/link'
import { LifeBuoy, ShieldCheck } from 'lucide-react'
import { EmptyState, formatRelative, formatWhen, PageHeader, StatusPill } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { SR_STATUS } from '@/lib/constants/statuses'
import { nowMs } from '@/lib/services/clock'
import { SrActions } from './sr-actions'

export const metadata: Metadata = { title: 'Service requests' }

type Row = { id: string; request_no: string; subject: string; body: string | null; status: string; created_at: string
  ack_due_at: string; acknowledged_at: string | null; resolve_due_at: string; resolved_at: string | null; resolution_note: string | null
  customer: { name: string } | null; property: { name: string } | null; unit: { pu: { label: string } | null } | null
  warranty: { card_no: string; kind: string; valid_until: string } | null }

// B38 — requests from customers, with the acknowledge and resolve clocks (BR-SR1). Open first,
// most urgent first.
export default async function ServiceRequestsPage({ searchParams }: PageProps<'/staff/service-requests'>) {
  await requireRole(['super_admin', 'cc_exec'])
  const { show } = await searchParams
  const supabase = await createClient()
  const { data } = await supabase.from('service_requests')
    .select('id, request_no, subject, body, status, created_at, ack_due_at, acknowledged_at, resolve_due_at, resolved_at, resolution_note, customer:customers(name), property:properties(name), unit:job_units(pu:property_units(label)), warranty:warranties(card_no, kind, valid_until)')
    .order('created_at', { ascending: false })
  const all = (data ?? []) as unknown as Row[]
  const openOnly = show !== 'all'
  const rows = (openOnly ? all.filter((r) => !['resolved', 'closed'].includes(r.status)) : all)
    .sort((a, b) => (a.acknowledged_at ? a.resolve_due_at : a.ack_due_at).localeCompare(b.acknowledged_at ? b.resolve_due_at : b.ack_due_at))
  const now = nowMs()
  return (
    <>
      <PageHeader title="Service requests" description="Warranty and after-care requests raised by customers from their portal." />
      <nav className="mb-4 flex gap-1.5" aria-label="Filter">
        {[['', `Open (${all.filter((r) => !['resolved', 'closed'].includes(r.status)).length})`], ['all', `All (${all.length})`]].map(([k, label]) => (
          <Link key={k} href={k ? `/staff/service-requests?show=${k}` : '/staff/service-requests'}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${(show ?? '') === k ? 'bg-redux-blue text-white' : 'bg-white text-muted-ink ring-1 ring-line hover:text-ink'}`}>{label}</Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState icon={LifeBuoy} title={openOnly ? 'No open requests' : 'No service requests yet'} body="When a customer raises one from their portal it lands here, with its response clock running." />
      ) : (
        <ul className="grid gap-4">
          {rows.map((r) => {
            const st = SR_STATUS[r.status]!
            const done = ['resolved', 'closed'].includes(r.status)
            const clock = !r.acknowledged_at ? { label: 'Acknowledge', due: r.ack_due_at } : { label: 'Resolve', due: r.resolve_due_at }
            const late = !done && new Date(clock.due).getTime() < now
            return (
              <li key={r.id} className="rounded-lg border border-line bg-white p-5 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="num text-xs font-semibold text-muted-ink">{r.request_no} · {formatRelative(r.created_at)}</p>
                    <p className="mt-1 text-base font-semibold text-ink">{r.subject}</p>
                    <p className="text-sm text-muted-ink">{r.customer?.name}{r.property?.name && r.property.name !== r.customer?.name ? ` · ${r.property.name}` : ''}{r.unit?.pu ? ` · Room ${r.unit.pu.label}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!done && <span className={`rounded-sm px-2 py-0.5 text-xs font-semibold ${late ? 'bg-danger-bg text-danger' : 'bg-surface text-muted-ink'}`}>{clock.label} {late ? 'overdue' : 'by'} {formatWhen(clock.due)}</span>}
                    <StatusPill tone={st.tone}>{st.label}</StatusPill>
                  </div>
                </div>
                {r.body && <p className="mt-3 rounded-md bg-surface px-3 py-2 text-sm text-ink">{r.body}</p>}
                {r.warranty && (
                  <p className={`mt-3 inline-flex items-center gap-1.5 text-xs font-medium ${r.warranty.valid_until >= new Date(now).toISOString().slice(0, 10) ? 'text-success' : 'text-danger'}`}>
                    <ShieldCheck className="size-4" aria-hidden /> Warranty {r.warranty.card_no} ({r.warranty.kind}) — {r.warranty.valid_until >= new Date(now).toISOString().slice(0, 10) ? `valid until ${formatWhen(r.warranty.valid_until, false)}` : 'expired'}
                  </p>
                )}
                {r.resolution_note && <p className="mt-3 text-sm text-muted-ink"><strong className="text-ink">Resolution:</strong> {r.resolution_note}</p>}
                {!done || r.status === 'resolved' ? <div className="mt-4 border-t border-line pt-4"><SrActions id={r.id} status={r.status} /></div> : null}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
