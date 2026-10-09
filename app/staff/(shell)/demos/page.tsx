import type { Metadata } from 'next'
import Link from 'next/link'
import { Gift } from 'lucide-react'
import { EmptyState, formatWhen, Money, PageHeader, Panel, StatusPill } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { DEMO_STATUS } from '@/lib/data/demos'
import { DemoTypeRow } from './demo-controls'

export const metadata: Metadata = { title: 'Demos' }

type Row = { id: string; demo_no: string; status: string; scheduled_for: string | null; internal_cost: number | null; created_at: string; exception_reason: string | null
  customer: { id: string; name: string; tier: string | null } | null; type: { name: string } | null; items: { count: number }[] }

const GROUPS = [
  { key: 'decide', title: 'To approve', statuses: ['proposed'] },
  { key: 'live', title: 'Approved and running', statuses: ['approved', 'scheduled', 'in_progress'] },
  { key: 'done', title: 'Done — waiting for the order', statuses: ['completed'] },
  { key: 'closed', title: 'Closed', statuses: ['converted', 'not_converted', 'rejected', 'cancelled'] },
] as const

// E22 (D28) — every free demo, by where it is. The numbers on top are the investment view (BR-D3/D4).
export default async function DemosPage() {
  const user = await requireRole(['super_admin', 'cc_exec'])
  const supabase = await createClient()
  const [{ data }, { data: types }] = await Promise.all([
    supabase.from('demos').select('id, demo_no, status, scheduled_for, internal_cost, created_at, exception_reason, customer:customers(id, name, tier), type:demo_types(name), items:demo_items(count)').order('created_at', { ascending: false }),
    supabase.from('demo_types').select('id, code, name, max_units, max_fittings, cost_cap, eligible_tiers, is_active').order('sort_order'),
  ])
  const rows = (data ?? []) as unknown as Row[]
  const finished = rows.filter((r) => ['completed', 'converted', 'not_converted'].includes(r.status))
  const converted = rows.filter((r) => r.status === 'converted')
  const cost = rows.reduce((s, r) => s + Number(r.internal_cost ?? 0), 0)
  const isAdmin = user.role === 'super_admin'

  return (
    <>
      <PageHeader title="Demos" description="Free room and single-fitting demos — REDUX’s investment in winning the order. Separate from paid pilots." />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Fact label="To approve" value={String(rows.filter((r) => r.status === 'proposed').length)} />
        <Fact label="Done" value={String(finished.length)} />
        <Fact label="Converted" value={finished.length ? `${Math.round((converted.length / finished.length) * 100)}%` : '—'} hint={`${converted.length} of ${finished.length}`} />
        <Fact label="Spent on demos" value={<Money value={cost.toFixed(0)} paise="never" />} hint={converted.length ? <>≈ <Money value={(cost / converted.length).toFixed(0)} paise="never" /> per order won</> : 'no order yet'} />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Gift} title="No demos yet" body="Propose one from a lead or an account once its fittings are assessed. A-tier accounts are offered a room demo, B-tier a single-fitting demo." />
      ) : (
        <div className="space-y-8">
          {GROUPS.map((g) => {
            const list = rows.filter((r) => (g.statuses as readonly string[]).includes(r.status))
            if (!list.length) return null
            return (
              <section key={g.key}>
                <h2 className="eyebrow mb-2 text-redux-blue">{g.title} · <span className="num">{list.length}</span></h2>
                <div className="relative overflow-x-auto rounded-lg border border-line bg-white shadow-card">
                  <table className="w-full min-w-[42rem] text-sm">
                    <thead><tr className="border-b border-line bg-surface text-left">{['Demo', 'Account', 'Type', 'Date', 'Cost', 'Status'].map((h) => <th key={h} className="eyebrow px-4 py-3 text-muted-ink">{h}</th>)}</tr></thead>
                    <tbody>
                      {list.map((r) => (
                        <tr key={r.id} className="border-b border-line last:border-0 hover:bg-select">
                          <td className="px-4 py-3"><Link href={`/staff/demos/${r.id}`} className="num font-semibold text-ink hover:text-redux-blue">{r.demo_no}</Link>
                            {r.exception_reason && <p className="text-xs text-warning">Exception asked</p>}</td>
                          <td className="px-4 py-3">{r.customer?.name}{r.customer?.tier && <span className="num ml-1.5 rounded-sm bg-pale px-1.5 text-xs font-bold text-redux-blue">{r.customer.tier}</span>}</td>
                          <td className="px-4 py-3 text-muted-ink">{r.type?.name} · <span className="num">{r.items[0]?.count ?? 0}</span> fittings</td>
                          <td className="px-4 py-3 whitespace-nowrap text-muted-ink">{r.scheduled_for ? formatWhen(r.scheduled_for, false) : '—'}</td>
                          <td className="num px-4 py-3">{r.internal_cost !== null ? <Money value={r.internal_cost} paise="never" /> : '—'}</td>
                          <td className="px-4 py-3"><StatusPill tone={DEMO_STATUS[r.status]!.tone}>{DEMO_STATUS[r.status]!.label}</StatusPill></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )
          })}
        </div>
      )}

      <Panel className="mt-8" title="Demo types">
        <table className="w-full min-w-[40rem] text-sm">
          <thead><tr className="border-b border-line text-left text-xs text-muted-ink">{['Type', 'Rooms', 'Fittings', 'Cost guide (₹)', 'Tiers', 'On', ''].map((h) => <th key={h} className="px-2 py-2 font-semibold">{h}</th>)}</tr></thead>
          <tbody>{(types ?? []).map((t) => <DemoTypeRow key={t.id} editable={isAdmin} type={{ id: t.id, name: t.name, max_units: t.max_units, max_fittings: t.max_fittings, cost_cap: t.cost_cap === null ? null : Number(t.cost_cap), eligible_tiers: t.eligible_tiers, is_active: t.is_active }} />)}</tbody>
        </table>
      </Panel>
    </>
  )
}

function Fact({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return <div className="rounded-lg border border-line bg-white p-3.5 shadow-card"><p className="eyebrow text-muted-ink">{label}</p><p className="num mt-1 text-lg font-semibold text-ink">{value}</p>{hint && <p className="mt-0.5 text-xs text-muted-ink">{hint}</p>}</div>
}
