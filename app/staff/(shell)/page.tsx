import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, Boxes, CalendarCheck, Factory, FileText, IndianRupee, Percent, Users } from 'lucide-react'
import { EmptyState, Money, PageHeader, Panel, StageTracker, StatusPill } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Dashboard' }

const SOURCE_LABEL: Record<string, string> = {
  website: 'Website', dealer: 'Dealer', meta_lead_ad: 'Meta lead ads', whatsapp_chat: 'WhatsApp chat',
  whatsapp_campaign: 'WhatsApp campaign', google_ads: 'Google Ads', call: 'Phone call', walk_in: 'Walk-in',
}

function pct(n: number, d: number) {
  return d === 0 ? '—' : `${Math.round((n / d) * 100)}%`
}

// B26 — every figure links through to its records (D14-06); all figures come from the same rows
// the lists show (D14-05, D17-05).
export default async function DashboardPage() {
  const user = await requireRole(['super_admin'])
  const supabase = await createClient()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [leadsRes, sourcesRes, campaignsRes, surveysRes, quotesRes, jobsRes, unitsRes, execsRes, rolesRes, callsRes, stockRes, settingRes] = await Promise.all([
    supabase.from('leads').select('id, status, source_id, assigned_to, created_at, campaign_id'),
    supabase.from('lead_sources').select('id, code'),
    supabase.from('campaigns').select('id, source_id, spend_to_date'),
    supabase.from('surveys').select('id, status, surveyor_id, submitted_at, lead_id'),
    supabase.from('quotations').select('id, status, total, survey_id, issued_at'),
    supabase.from('jobs').select('id, job_no, status, current_stage, is_pilot, customer_id, customers(name), properties(name)').neq('status', 'completed').order('created_at'),
    supabase.from('job_units').select('id, job_id, current_stage, status'),
    supabase.from('profiles').select('id, full_name').eq('is_active', true),
    supabase.from('user_roles').select('user_id, role'),
    supabase.from('calls').select('agent_id'),
    supabase.from('v_low_stock').select('id, sku, name, quantity, min_level, uom'),
    supabase.from('settings').select('value').eq('key', 'survey_visit_cost_inr').maybeSingle(),
  ])
  const leads = leadsRes.data ?? []
  const sources = new Map((sourcesRes.data ?? []).map((s) => [s.id, s.code]))
  const surveys = surveysRes.data ?? []
  const quotes = quotesRes.data ?? []
  const units = unitsRes.data ?? []

  // Row 1 — KPIs
  const leadsThisMonth = leads.filter((l) => l.created_at >= monthStart).length
  const surveysDone = surveys.filter((s) => s.status === 'submitted').length
  const won = leads.filter((l) => l.status === 'won').length
  const quotedValue = quotes.filter((q) => ['sent', 'approved'].includes(q.status)).reduce((s, q) => s + Number(q.total), 0)
  const atFactory = units.filter((u) => u.current_stage === 'at_eurobrass').length
  const visitCost = Number(settingRes.data?.value ?? 0)
  const surveyCostPerWon = won ? (surveysDone * visitCost) / won : null

  // Row 2 — leads by source, with spend → cost per lead and per won job (D14-02)
  const spend = new Map<string, number>()
  for (const c of campaignsRes.data ?? []) spend.set(c.source_id, (spend.get(c.source_id) ?? 0) + Number(c.spend_to_date ?? 0))
  const bySource = [...new Set(leads.map((l) => l.source_id))].map((sid) => {
    const rows = leads.filter((l) => l.source_id === sid)
    const wins = rows.filter((l) => l.status === 'won').length
    const s = spend.get(sid)
    return { code: sources.get(sid) ?? '?', count: rows.length, wins, cpl: s ? s / rows.length : null, cpw: s && wins ? s / wins : null }
  }).sort((a, b) => b.count - a.count)
  const maxSource = Math.max(1, ...bySource.map((s) => s.count))

  // Teams (D14-03, D14-04)
  // user_roles and profiles both key on auth.users, so they are joined here rather than embedded
  const roleOf = new Map((rolesRes.data ?? []).map((r) => [r.user_id, r.role]))
  const people = (execsRes.data ?? []).map((p) => ({ ...p, role: roleOf.get(p.id) }))
  const callsBy = new Map<string, number>()
  for (const c of callsRes.data ?? []) callsBy.set(c.agent_id, (callsBy.get(c.agent_id) ?? 0) + 1)
  const execs = people.filter((p) => p.role === 'cc_exec').map((p) => {
    const mine = leads.filter((l) => l.assigned_to === p.id)
    const booked = mine.filter((l) => ['survey_booked', 'surveyed', 'quoted', 'won'].includes(l.status)).length
    return { id: p.id, name: p.full_name, leads: mine.length, calls: callsBy.get(p.id) ?? 0, booked, won: mine.filter((l) => l.status === 'won').length }
  })
  const surveyors = people.filter((p) => p.role === 'surveyor').map((p) => {
    const mine = surveys.filter((s) => s.surveyor_id === p.id)
    const done = mine.filter((s) => s.status === 'submitted')
    const value = quotes.filter((q) => done.some((s) => s.id === q.survey_id) && q.status !== 'superseded').reduce((s, q) => s + Number(q.total), 0)
    return { id: p.id, name: p.full_name, visits: mine.length, done: done.length, upcoming: mine.filter((s) => s.status === 'scheduled').length, value }
  })

  const jobs = jobsRes.data ?? []
  const stock = stockRes.data ?? []

  return (
    <>
      <PageHeader eyebrow="Super Admin" title={`Good to see you, ${user.name.split(' ')[0]}`}
        description={`The whole operation, from one screen · ${new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(now)}`} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiLink href="/staff/leads" label="Leads this month" value={leadsThisMonth} icon={Users} hint={`${leads.length} in total`} />
        <KpiLink href="/staff/surveys" label="Free surveys done" value={surveysDone} icon={CalendarCheck} hint={`${surveys.filter((s) => s.status === 'scheduled').length} booked ahead`} />
        <KpiLink href="/staff/leads?status=won" label="Survey → order" value={pct(won, surveysDone)} icon={Percent} hint={`${won} won of ${surveysDone} surveyed`} />
        <KpiLink href="/staff/quotes" label="Quoted value" value={<Money value={quotedValue.toFixed(2)} paise="never" />} icon={FileText} hint="Sent and approved, incl. GST" />
        <KpiLink href="/staff/jobs" label="Rooms at factory" value={atFactory} icon={Factory} hint="At Eurobrass now" />
        <KpiLink href="/staff/admin/reports" label="Survey cost / won job" value={surveyCostPerWon === null ? '—' : <Money value={surveyCostPerWon.toFixed(2)} paise="never" />} icon={IndianRupee}
          hint={`${surveysDone} free visits × ₹${visitCost.toLocaleString('en-IN')}`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <Panel title="Leads by source" className="xl:col-span-3" action={<Link href="/staff/leads" className="text-sm font-medium text-redux-blue hover:underline">All leads</Link>}>
          <ul className="space-y-3">
            {bySource.map((s) => (
              <li key={s.code}>
                <Link href={`/staff/leads?source=${s.code}`} className="group grid grid-cols-[9.5rem_1fr_auto] items-center gap-3">
                  <span className="truncate text-sm text-ink group-hover:text-redux-blue">{SOURCE_LABEL[s.code] ?? s.code}</span>
                  <span className="h-7 overflow-hidden rounded-sm bg-surface">
                    <span className="flex h-full items-center rounded-sm bg-redux-blue px-2 text-xs font-semibold text-white"
                      style={{ width: `${Math.max(8, (s.count / maxSource) * 100)}%` }}>
                      <span className="num">{s.count}</span>
                    </span>
                  </span>
                  <span className="num w-44 text-right text-xs text-muted-ink">
                    {s.wins} won{s.cpl !== null && <> · <Money value={s.cpl.toFixed(2)} paise="never" />/lead</>}
                    {s.cpw !== null && <> · <Money value={s.cpw.toFixed(2)} paise="never" />/win</>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-faint">Cost per lead and per won job use the campaign spend entered under Admin → Campaigns.</p>
        </Panel>

        <Panel title="Care executives" className="xl:col-span-2" bodyClassName="p-0">
          <TeamTable head={['Executive', 'Leads', 'Calls', 'Booked', 'Won']}
            rows={execs.map((e) => [e.name, e.leads, e.calls, e.booked, e.won])} />
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <Panel title="Jobs in progress" className="xl:col-span-3" action={<Link href="/staff/jobs" className="text-sm font-medium text-redux-blue hover:underline">All jobs</Link>}>
          {jobs.length === 0 ? (
            <EmptyState icon={Factory} title="No jobs running" body="An approved quotation creates its job automatically." />
          ) : (
            <ul className="divide-y divide-line">
              {jobs.map((j) => {
                const js = units.filter((u) => u.job_id === j.id)
                const blocked = js.filter((u) => u.status === 'blocked').length
                return (
                  <li key={j.id} className="py-4 first:pt-0 last:pb-0">
                    <Link href={`/staff/jobs/${j.id}`} className="block">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <span>
                          <span className="font-semibold text-ink hover:text-redux-blue">{(j.properties as unknown as { name: string } | null)?.name}</span>
                          <span className="ml-2 text-xs text-muted-ink">{j.job_no} · {js.length} {js.length === 1 ? 'room' : 'rooms'}</span>
                        </span>
                        <span className="flex gap-1.5">
                          {j.is_pilot && <StatusPill tone="waiting">Pilot</StatusPill>}
                          {blocked > 0 && <StatusPill tone="failed">{blocked} blocked — hotel civil work</StatusPill>}
                        </span>
                      </div>
                      <StageTracker current={j.current_stage} compact />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <div className="space-y-6 xl:col-span-2">
          <Panel title="Surveyors" bodyClassName="p-0">
            <TeamTable head={['Surveyor', 'Done', 'Booked', 'Quote value']}
              rows={surveyors.map((s) => [s.name, s.done, s.upcoming, <Money key="v" value={s.value.toFixed(2)} paise="never" />])} />
          </Panel>
          <Panel title="Stock alerts" action={<Link href="/staff/admin/stock" className="text-sm font-medium text-redux-blue hover:underline">Stock</Link>}>
            {stock.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-ink"><Boxes className="size-4" aria-hidden /> Everything is above its minimum.</p>
            ) : (
              <ul className="space-y-2.5">
                {stock.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />
                      <span className="truncate text-sm text-ink">{s.name}</span>
                    </span>
                    <span className="num shrink-0 text-sm">
                      <span className="font-semibold text-danger">{Number(s.quantity)}</span>
                      <span className="text-muted-ink"> / min {Number(s.min_level)} {s.uom}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  )
}

function KpiLink({ href, label, value, hint, icon: Icon }: { href: string; label: string; value: React.ReactNode; hint?: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Link href={href} className="group rounded-lg border border-line bg-white p-5 shadow-card transition-colors hover:border-redux-blue">
      <div className="flex items-start justify-between gap-2">
        <p className="eyebrow text-muted-ink">{label}</p>
        <span className="flex size-8 items-center justify-center rounded-full bg-select text-redux-blue"><Icon className="size-4" /></span>
      </div>
      <p className="num mt-2 text-[26px] leading-none font-semibold text-ink group-hover:text-redux-blue">{value}</p>
      {hint && <p className="mt-2 text-xs text-muted-ink">{hint}</p>}
    </Link>
  )
}

function TeamTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line bg-surface text-left">
          {head.map((h, i) => <th key={h} className={`eyebrow px-5 py-2.5 text-muted-ink ${i ? 'text-right' : ''}`}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-line last:border-0">
            {r.map((c, j) => <td key={j} className={`px-5 py-3 ${j ? 'num text-right' : 'font-medium text-ink'}`}>{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
