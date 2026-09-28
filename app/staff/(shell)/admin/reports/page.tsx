import type { Metadata } from 'next'
import Link from 'next/link'
import { Kpi, Money, PageHeader, Panel } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { SOURCES } from '@/lib/constants/sources'
import { formatInr } from '@/lib/services/money'
import { nowMs } from '@/lib/services/clock'

export const metadata: Metadata = { title: 'Reports' }

const FUNNEL = [
  { key: 'all', label: 'Enquiries' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'survey_booked', label: 'Free survey booked' },
  { key: 'surveyed', label: 'Surveyed' },
  { key: 'quoted', label: 'Quoted' },
  { key: 'won', label: 'Won' },
] as const
const RANK: Record<string, number> = { new: 0, contacted: 1, survey_booked: 2, surveyed: 3, quoted: 4, won: 5, lost: -1 }

// B36 — the funnel, where leads come from and what they cost, and money in. Every figure links to
// its records. Range: the last 90 days by default.
export default async function ReportsPage({ searchParams }: PageProps<'/staff/admin/reports'>) {
  await requireRole(['super_admin'])
  const { days: d } = await searchParams
  const days = [30, 90, 365].includes(Number(d)) ? Number(d) : 90
  const since = new Date(nowMs() - days * 86_400_000).toISOString()
  const supabase = await createClient()
  const [{ data: leads }, { data: history }, { data: campaigns }, { data: quotes }, { data: invoices }, { data: visitCost }, { data: surveys }] = await Promise.all([
    supabase.from('leads').select('id, status, source:lead_sources(code), created_at').gte('created_at', since),
    supabase.from('lead_status_history').select('lead_id, to_status'),
    supabase.from('campaigns').select('spend_to_date, source:lead_sources(code)'),
    supabase.from('quotations').select('status, total, you_save, created_at').gte('created_at', since).neq('status', 'superseded'),
    supabase.from('invoices').select('status, total, amount_paid, issue_date').neq('status', 'draft').neq('status', 'cancelled'),
    supabase.from('settings').select('value').eq('key', 'survey_visit_cost_inr').maybeSingle(),
    supabase.from('surveys').select('id, status').gte('scheduled_at', since),
  ])
  const L = (leads ?? []) as unknown as { id: string; status: string; source: { code: string } | null }[]
  // a lead reached a stage if its current status is past it, or it passed through it before being lost
  const reached = new Map<string, number>()
  for (const l of L) reached.set(l.id, RANK[l.status] ?? 0)
  for (const h of history ?? []) if (reached.has(h.lead_id)) reached.set(h.lead_id, Math.max(reached.get(h.lead_id)!, RANK[h.to_status] ?? 0))
  const funnel = FUNNEL.map((f, i) => ({ ...f, n: i === 0 ? L.length : [...reached.values()].filter((r) => r >= i).length }))
  const won = funnel.at(-1)!.n
  const doneSurveys = (surveys ?? []).filter((s) => s.status === 'submitted').length
  const cost = Number(visitCost?.value ?? 0)

  const spend = new Map<string, number>()
  for (const c of (campaigns ?? []) as unknown as { spend_to_date: number | null; source: { code: string } | null }[]) if (c.source) spend.set(c.source.code, (spend.get(c.source.code) ?? 0) + Number(c.spend_to_date ?? 0))
  const bySource = Object.keys(SOURCES).map((code) => {
    const rows = L.filter((l) => l.source?.code === code)
    const w = rows.filter((l) => l.status === 'won').length
    const s = spend.get(code) ?? 0
    return { code, n: rows.length, won: w, spend: s }
  }).filter((r) => r.n > 0).sort((a, b) => b.n - a.n)
  const maxSource = Math.max(1, ...bySource.map((r) => r.n))

  const Q = quotes ?? []
  const quoted = Q.reduce((s, q) => s + Number(q.total), 0)
  const approved = Q.filter((q) => q.status === 'approved')
  const saved = approved.reduce((s, q) => s + Number(q.you_save), 0)
  const I = invoices ?? []
  const billed = I.reduce((s, i) => s + Number(i.total), 0)
  const collected = I.reduce((s, i) => s + Number(i.amount_paid), 0)

  return (
    <>
      <PageHeader eyebrow="Admin" title="Reports" description="From first enquiry to money in the bank."
        actions={<nav className="flex gap-1.5" aria-label="Range">{[30, 90, 365].map((n) => (
          <Link key={n} href={`/staff/admin/reports?days=${n}`} className={`rounded-full px-3 py-1.5 text-sm font-medium ${days === n ? 'bg-redux-blue text-white' : 'bg-white text-muted-ink ring-1 ring-line'}`}>{n === 365 ? '1 year' : `${n} days`}</Link>
        ))}</nav>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Enquiries" value={L.length} hint={`${won} won · ${L.length ? Math.round((won / L.length) * 100) : 0}% conversion`} />
        <Kpi label="Survey → order" value={`${doneSurveys ? Math.round((won / doneSurveys) * 100) : 0}%`} hint={`${doneSurveys} free surveys done`} />
        <Kpi label="Free-survey cost per won job" value={won ? formatInr(String(Math.round((doneSurveys * cost) / won)), 'never') : '—'} hint={`${formatInr(String(cost), 'never')} per visit`} />
        <Kpi label="Customers saved" value={<Money value={saved.toFixed(0)} paise="never" />} hint="vs buying new at market" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Funnel">
          <ol className="space-y-2.5">
            {funnel.map((f, i) => {
              const pct = funnel[0]!.n ? (f.n / funnel[0]!.n) * 100 : 0
              const step = i > 0 && funnel[i - 1]!.n ? Math.round((f.n / funnel[i - 1]!.n) * 100) : null
              return (
                <li key={f.key}>
                  <div className="mb-1 flex justify-between text-sm"><span className="text-ink">{f.label}</span><span className="num text-muted-ink"><strong className="text-ink">{f.n}</strong>{step !== null && ` · ${step}% of previous`}</span></div>
                  <div className="h-7 rounded-md bg-surface"><div className={`h-7 rounded-md ${i === funnel.length - 1 ? 'bg-redux-lime' : 'bg-redux-blue'}`} style={{ width: `${Math.max(pct, 2)}%` }} /></div>
                </li>
              )
            })}
          </ol>
        </Panel>

        <Panel title="Where leads come from">
          <table className="w-full text-sm">
            <thead><tr className="text-left"><th className="eyebrow pb-2 text-muted-ink">Source</th><th className="eyebrow pb-2 text-right text-muted-ink">Leads</th><th className="eyebrow pb-2 text-right text-muted-ink">Won</th><th className="eyebrow pb-2 text-right text-muted-ink">Cost / lead</th><th className="eyebrow pb-2 text-right text-muted-ink">Cost / win</th></tr></thead>
            <tbody>
              {bySource.map((r) => (
                <tr key={r.code} className="border-t border-line">
                  <td className="py-2">
                    <Link href={`/staff/leads?source=${r.code}`} className="flex items-center gap-2 text-ink hover:text-redux-blue"><span className={`size-2 rounded-full ${SOURCES[r.code]!.dot}`} aria-hidden />{SOURCES[r.code]!.label}</Link>
                    <div className="mt-1 h-1.5 rounded-full bg-surface"><div className="h-1.5 rounded-full bg-redux-blue/70" style={{ width: `${(r.n / maxSource) * 100}%` }} /></div>
                  </td>
                  <td className="num py-2 text-right">{r.n}</td>
                  <td className="num py-2 text-right">{r.won}</td>
                  <td className="num py-2 text-right text-muted-ink">{r.spend ? formatInr(String(Math.round(r.spend / r.n)), 'never') : '—'}</td>
                  <td className="num py-2 text-right text-muted-ink">{r.spend && r.won ? formatInr(String(Math.round(r.spend / r.won)), 'never') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Quotations">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="eyebrow text-muted-ink">Quoted value</dt><dd className="mt-1 text-xl font-semibold"><Money value={quoted.toFixed(0)} paise="never" /></dd></div>
            <div><dt className="eyebrow text-muted-ink">Approved</dt><dd className="mt-1 text-xl font-semibold"><Money value={approved.reduce((s, q) => s + Number(q.total), 0).toFixed(0)} paise="never" /></dd></div>
            <div><dt className="eyebrow text-muted-ink">Quotes sent</dt><dd className="num mt-1 text-xl font-semibold">{Q.filter((q) => ['sent', 'approved', 'expired', 'rejected'].includes(q.status)).length}</dd></div>
            <div><dt className="eyebrow text-muted-ink">Approval rate</dt><dd className="num mt-1 text-xl font-semibold">{Q.length ? Math.round((approved.length / Q.filter((q) => q.status !== 'draft').length || 0) * 100) : 0}%</dd></div>
          </dl>
        </Panel>

        <Panel title="Money in">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="eyebrow text-muted-ink">Invoiced</dt><dd className="mt-1 text-xl font-semibold"><Money value={billed.toFixed(0)} paise="never" /></dd></div>
            <div><dt className="eyebrow text-muted-ink">Collected</dt><dd className="mt-1 text-xl font-semibold text-success"><Money value={collected.toFixed(0)} paise="never" /></dd></div>
          </dl>
          <div className="mt-4 h-3 rounded-full bg-surface"><div className="h-3 rounded-full bg-success" style={{ width: `${billed ? (collected / billed) * 100 : 0}%` }} /></div>
          <p className="mt-2 text-xs text-muted-ink">{billed ? Math.round((collected / billed) * 100) : 0}% collected · <Link href="/staff/admin/invoices" className="font-medium text-redux-blue hover:underline">see invoices</Link></p>
        </Panel>
      </div>
    </>
  )
}
