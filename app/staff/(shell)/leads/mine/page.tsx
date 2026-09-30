import type { Metadata } from 'next'
import Link from 'next/link'
import { ScrollIntoViewOnChange } from '@/components/patterns/scroll-into-view'
import { Inbox, MapPin, Users } from 'lucide-react'
import { cn } from 'cn'
import { EmptyState, LEAD_STATUS, PageHeader, StatusPill, Timeline } from '@/components/patterns'
import { SourceBadge, SlaTimer } from '@/components/features/leads/bits'
import { SOURCES } from '@/lib/constants/sources'
import { LeadWorkPane } from '@/components/features/leads/work-pane'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { LEAD_COLUMNS, loadLeadTimeline, loadPickLists, toWorkLead, type LeadRow } from '@/lib/data/leads'

export const metadata: Metadata = { title: 'My leads' }

const OPEN = ['new', 'contacted', 'survey_booked', 'surveyed', 'quoted']

// B6 — "who do I call next, and can I book their survey in this call?" Sorted by the SLA timer,
// most overdue first; everything on the right happens without navigating (UX principle 2).
export default async function MyLeadsPage({ searchParams }: PageProps<'/staff/leads/mine'>) {
  const user = await requireRole(['cc_exec', 'super_admin'])
  const sp = await searchParams
  const source = typeof sp.source === 'string' ? sp.source : undefined
  const supabase = await createClient()

  let query = supabase.from('leads').select(LEAD_COLUMNS).in('status', OPEN)
  if (user.role === 'cc_exec') query = query.eq('assigned_to', user.id)
  const { data } = await query
  let leads = (data ?? []) as unknown as LeadRow[]

  const { data: fus } = await supabase.from('follow_ups').select('lead_id, due_at').is('completed_at', null)
  const nextFollowUp = new Map<string, string>()
  for (const f of fus ?? []) if (!nextFollowUp.has(f.lead_id) || f.due_at < nextFollowUp.get(f.lead_id)!) nextFollowUp.set(f.lead_id, f.due_at)

  // New leads by SLA first; then anything with a follow-up due; then the pipeline behind them
  const rank = (l: LeadRow) => l.status === 'new' ? 0 : nextFollowUp.has(l.id) ? 1 : l.status === 'contacted' ? 2 : 3
  const due = (l: LeadRow) => (l.status === 'new' ? l.sla_due_at : nextFollowUp.get(l.id)) ?? l.created_at
  leads.sort((a, b) => rank(a) - rank(b) || due(a).localeCompare(due(b)))
  const counts = new Map<string, number>()
  for (const l of leads) counts.set(l.source?.code ?? '', (counts.get(l.source?.code ?? '') ?? 0) + 1)
  if (source) leads = leads.filter((l) => l.source?.code === source)

  const selectedId = typeof sp.id === 'string' ? sp.id : leads[0]?.id
  const selected = leads.find((l) => l.id === selectedId) ?? leads[0]

  const [lists, timeline, openSurvey] = selected
    ? await Promise.all([
        loadPickLists(),
        loadLeadTimeline(selected.id),
        supabase.from('surveys').select('id').eq('lead_id', selected.id).neq('status', 'cancelled').limit(1),
      ])
    : [null, [], null]

  const tabs = ['', 'meta_lead_ad', 'whatsapp_chat', 'google_ads', 'website']
  return (
    <>
      <PageHeader title="My leads" description={<><span className="num font-semibold text-ink">{leads.length}</span> open · sorted by call-back SLA, most overdue first</>}
        actions={<nav aria-label="Filter by source" className="flex flex-wrap gap-1 rounded-md bg-white p-1 shadow-card">
          {tabs.map((t) => (
            <Link key={t || 'all'} href={t ? `?source=${t}` : '?'} aria-current={(source ?? '') === t ? 'page' : undefined}
              className={cn('rounded-sm px-3 py-1.5 text-xs font-semibold', (source ?? '') === t ? 'bg-redux-blue text-white' : 'text-muted-ink hover:bg-surface')}>
              {t ? SOURCES[t]?.label : 'All'}{t && counts.get(t) ? <span className="num ml-1 opacity-70">{counts.get(t)}</span> : null}
            </Link>
          ))}
        </nav>} />

      {leads.length === 0 ? (
        <EmptyState icon={Inbox} title="Your queue is clear" body="New enquiries from every channel land here the moment they arrive, sorted by who to call first." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <ol className="max-h-[calc(100vh-13rem)] space-y-2 overflow-y-auto pr-1" aria-label="Lead queue">
            {leads.map((l) => {
              const active = l.id === selected?.id
              const st = LEAD_STATUS[l.status]
              return (
                <li key={l.id}>
                  <Link href={`?${new URLSearchParams({ ...(source ? { source } : {}), id: l.id })}`} aria-current={active ? 'true' : undefined}
                    className={cn('block rounded-lg border bg-white p-3.5 transition-colors',
                      active ? 'border-redux-blue ring-1 ring-redux-blue' : 'border-line hover:border-redux-blue/50')}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-semibold text-ink">{l.property_name ?? l.name ?? l.phone}</p>
                      <SlaTimer due={l.status === 'new' ? l.sla_due_at : nextFollowUp.get(l.id) ?? null} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-ink">
                      {[l.customer_type === 'hotel' ? 'Hotel' : l.customer_type === 'home' ? 'Home' : l.customer_type === 'dealer' ? 'Dealer' : null,
                        l.unit_count ? `${l.unit_count} ${l.customer_type === 'hotel' ? 'rooms' : 'baths'}` : null, l.city?.name].filter(Boolean).join(' · ')}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <SourceBadge code={l.source?.code ?? ''} />
                      {st && <StatusPill tone={st.tone}>{st.label}</StatusPill>}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ol>

          {selected && lists && (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
              <div className="min-w-0 space-y-5">
                <div className="rounded-lg border border-line bg-white p-5 shadow-card">
                  <ScrollIntoViewOnChange when={selected.id} enabled={typeof sp.id === 'string'} />
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-ink">{selected.property_name ?? selected.name}</h2>
                      <p className="mt-1 text-sm text-muted-ink">
                        {selected.name}{selected.enquirer_role ? ` · ${selected.enquirer_role}` : ''} · <span className="num">{selected.phone}</span>
                      </p>
                    </div>
                    <Link href={`/staff/leads/${selected.id}`} className="text-sm font-medium text-redux-blue hover:underline">Open lead →</Link>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 text-sm 2xl:grid-cols-4">
                    <Fact label="Source"><SourceBadge code={selected.source?.code ?? ''} /></Fact>
                    <Fact label="Status">{LEAD_STATUS[selected.status] && <StatusPill tone={LEAD_STATUS[selected.status]!.tone}>{LEAD_STATUS[selected.status]!.label}</StatusPill>}</Fact>
                    <Fact label="City"><span className="flex items-center gap-1"><MapPin className="size-3.5 text-faint" aria-hidden />{selected.city?.name ?? '—'}</span></Fact>
                    <Fact label={selected.customer_type === 'hotel' ? 'Rooms' : 'Bathrooms'}><span className="num">{selected.unit_count ?? '—'}</span></Fact>
                  </dl>
                </div>
                <div className="rounded-lg border border-line bg-white p-5 shadow-card">
                  <h3 className="mb-4 text-[15px] font-semibold text-ink">Activity</h3>
                  {timeline.length ? <Timeline items={timeline.slice(0, 8)} /> : <p className="text-sm text-muted-ink">Nothing yet — the first call starts the story.</p>}
                </div>
              </div>
              <LeadWorkPane lead={toWorkLead(selected, (openSurvey?.data?.length ?? 0) > 0)} {...lists} />
            </div>
          )}
        </div>
      )}
      {user.role === 'super_admin' && (
        <p className="mt-6 flex items-center gap-1.5 text-xs text-faint"><Users className="size-3.5" aria-hidden /> Super Admin sees every executive’s open leads here.</p>
      )}
    </>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="eyebrow text-faint">{label}</dt>
      <dd className="mt-1 text-ink">{children}</dd>
    </div>
  )
}
