import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  Banknote, CalendarCheck, CalendarClock, ClipboardList, FileText, Globe, Hammer, LifeBuoy, MapPin, MessageCircle, MessagesSquare,
  Phone, Receipt, ShieldCheck, StickyNote, Users,
} from 'lucide-react'
import { formatRelative, formatWhen, Money, PageHeader, Panel, StatusPill, Timeline, type TimelineItem } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { nowMs } from '@/lib/services/clock'
import { AccountActions, ActivityButton, RequirementsButton } from './account-actions'
import { ProposeDemoButton } from '@/components/features/demos/propose-demo'
import { DEMO_STATUS, demoCandidates } from '@/lib/data/demos'
import { LinkReferral } from '../../referrals/referral-controls'

export const metadata: Metadata = { title: 'Account' }

const ICON: Record<string, LucideIcon> = {
  lead_status: ClipboardList, call: Phone, note: StickyNote, survey: CalendarCheck, quotation: FileText, approval: ShieldCheck,
  job_stage: Hammer, invoice: Receipt, payment: Banknote, service_request: LifeBuoy, message: MessageCircle, activity: Users,
  whatsapp: MessagesSquare, follow_up: CalendarClock,
}

const TABS = [
  ['overview', 'Overview'], ['timeline', 'Timeline'], ['work', 'Work & money'], ['assessments', 'Assessments & reports'], ['comms', 'Follow-ups & messages'],
] as const
type Tab = (typeof TABS)[number][0]

type Supa = Awaited<ReturnType<typeof createClient>>
type Ctx = { id: string; supabase: Supa; noun: string; isAdmin: boolean }

const words = (s: string) => s.replaceAll('_', ' ')

// E20 (D26) — the account 360°: who they are, what they need, everything we've done with them and
// what happens next. Tabs are links (?tab=) so each view is shareable and server-rendered.
export default async function AccountPage({ params, searchParams }: PageProps<'/staff/accounts/[id]'>) {
  const user = await requireRole(['super_admin', 'cc_exec'])
  const { id } = await params
  const sp = await searchParams
  const tab: Tab = (TABS.find(([k]) => k === sp.tab)?.[0] ?? 'overview') as Tab
  const supabase = await createClient()
  const { data: a } = await supabase.from('customers')
    .select('id, name, legal_name, type, kind, tier, size_units, is_prospect, converted_at, verified_at, gstin, created_at, segment_id, group_id, account_owner_id, current_requirements, future_requirements, next_action, next_action_at, website, segment:segments(name), group:customer_groups(name), owner:profiles!customers_account_owner_id_fkey(full_name)')
    .eq('id', id).maybeSingle()
  if (!a) notFound()
  const acc = a as unknown as typeof a & { segment: { name: string } | null; group: { name: string } | null; owner: { full_name: string } | null }
  const isAdmin = user.role === 'super_admin'
  const [{ data: sum }, admin] = await Promise.all([
    supabase.from('v_account_summary').select('*').eq('customer_id', id).maybeSingle(),
    isAdmin ? Promise.all([
      supabase.from('segments').select('id, name').eq('is_b2c', false).eq('is_active', true).order('sort_order'),
      supabase.from('customer_groups').select('id, name').order('name'),
      supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name'),
    ]) : null,
  ])
  const ctx: Ctx = { id, supabase, noun: acc.type === 'home' ? 'Bathroom' : 'Room', isAdmin }
  const overdue = acc.next_action_at && new Date(acc.next_action_at).getTime() < nowMs()

  const body =
    tab === 'timeline' ? await timeline(ctx)
    : tab === 'work' ? await work(ctx)
    : tab === 'assessments' ? await assessments(ctx)
    : tab === 'comms' ? await comms(ctx)
    : await overview(ctx, acc)

  return (
    <>
      <PageHeader back={{ href: '/staff/accounts', label: 'Accounts' }} title={acc.name}
        description={[acc.legal_name && acc.legal_name !== acc.name ? acc.legal_name : null, acc.segment?.name, acc.group?.name ? `part of ${acc.group.name}` : null].filter(Boolean).join(' · ') || undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={acc.is_prospect ? 'waiting' : 'positive'}>{acc.is_prospect ? 'Prospect' : 'Customer'}</StatusPill>
            {acc.verified_at ? <StatusPill tone="positive">Verified</StatusPill> : <StatusPill tone="neutral">Not verified</StatusPill>}
            {acc.tier && <span className="num rounded-sm bg-pale px-2 py-1 text-xs font-bold text-redux-blue">Tier {acc.tier}</span>}
            {admin && (
              <AccountActions id={id} verified={!!acc.verified_at}
                profile={{ legal_name: acc.legal_name ?? '', segment_id: acc.segment_id, group_id: acc.group_id, account_owner_id: acc.account_owner_id, size_units: acc.size_units }}
                segments={admin[0].data ?? []} groups={admin[1].data ?? []} staff={admin[2].data ?? []} />
            )}
          </div>
        } />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Fact label="Lifetime billed" value={<Money value={Number(sum?.lifetime_billed ?? 0).toFixed(0)} paise="never" />} hint={<>paid <Money value={Number(sum?.lifetime_paid ?? 0).toFixed(0)} paise="never" /></>} />
        <Fact label="Open proposals" value={<Money value={Number(sum?.open_proposal_value ?? 0).toFixed(0)} paise="never" />} />
        <Fact label="Jobs" value={`${sum?.jobs_done ?? 0} done`} hint={sum?.jobs_total ? `${sum.jobs_total} in all` : 'none yet'} />
        <Fact label={`${ctx.noun}s restored`} value={String(sum?.rooms_restored ?? 0)} hint={`${sum?.fittings_ordered ?? 0} fittings ordered`} />
        <Fact label="Last work" value={sum?.last_work_on ? formatWhen(sum.last_work_on, false) : '—'} hint={`${sum?.assessments_done ?? 0} assessments`} />
        <Fact label="Account owner" value={acc.owner?.full_name ?? 'Not assigned'} hint={`since ${formatWhen(acc.created_at, false)}`} />
      </div>

      <Panel className="mb-5" title="Next action" action={<RequirementsButton customerId={id} value={{
        current_requirements: acc.current_requirements ?? '', future_requirements: acc.future_requirements ?? '', next_action: acc.next_action ?? '',
        next_action_at: acc.next_action_at ? new Date(acc.next_action_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : '', website: acc.website ?? '',
      }} />}>
        {acc.next_action
          ? <p className="text-sm text-ink"><span className="font-semibold">{acc.next_action}</span>{acc.next_action_at && <span className={`ml-2 text-xs ${overdue ? 'font-semibold text-danger' : 'text-muted-ink'}`}>{overdue ? 'overdue · ' : 'by '}{formatWhen(acc.next_action_at, false)}</span>}</p>
          : <p className="text-sm text-muted-ink">No next step set. Add one so this account doesn’t go quiet.</p>}
      </Panel>

      <nav aria-label="Account sections" className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {TABS.map(([k, label]) => (
          <Link key={k} href={k === 'overview' ? `/staff/accounts/${id}` : `/staff/accounts/${id}?tab=${k}`} aria-current={tab === k ? 'page' : undefined}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${tab === k ? 'bg-redux-blue text-white' : 'bg-white text-muted-ink ring-1 ring-line hover:text-ink'}`}>{label}</Link>
        ))}
      </nav>
      {body}
    </>
  )
}

type Acc = { tier: string | null; current_requirements: string | null; future_requirements: string | null; website: string | null; gstin: string | null; size_units: number | null; kind: string | null }

async function overview({ id, supabase }: Ctx, acc: Acc) {
  const [contacts, properties, leads, mix, sum, demos, candidates, code, refsIn, refsOut, rewards, accounts] = await Promise.all([
    supabase.from('customer_contacts').select('id, name, phone, email, role_title, is_admin, is_primary, user_id, is_active').eq('customer_id', id).order('is_primary', { ascending: false }),
    supabase.from('properties').select('id, name, address, city:cities(name)').eq('customer_id', id),
    supabase.from('leads').select('id, status, created_at, raw_payload, source:lead_sources(name)').eq('customer_id', id).order('created_at'),
    supabase.from('quotation_lines').select('line_total, wt:work_types(name), q:quotations!inner(customer_id, status)').eq('q.customer_id', id).eq('q.status', 'approved'),
    supabase.from('v_account_summary').select('discount_total, approved_value, first_source, first_enquiry_at, open_service_requests').eq('customer_id', id).maybeSingle(),
    supabase.from('demos').select('id, demo_no, status, scheduled_for, type:demo_types(name)').eq('customer_id', id).order('created_at', { ascending: false }),
    demoCandidates(id),
    supabase.rpc('referral_code_for', { p_customer: id }),
    supabase.from('referrals').select('id, status, referrer:customers!referrals_referrer_customer_id_fkey(id, name)').eq('referred_customer_id', id).neq('status', 'rejected').maybeSingle(),
    supabase.from('referrals').select('id, status').eq('referrer_customer_id', id).neq('status', 'rejected'),
    supabase.from('v_rewards').select('id, kind, amount, status').eq('customer_id', id),
    supabase.from('customers').select('id, name').eq('kind', 'business').neq('id', id).order('name'),
  ])
  // the demo the policy offers this account's latest open enquiry (CR §3.4)
  const openLead = (leads.data ?? []).toReversed().find((l) => !['won', 'lost'].includes(l.status))
  const services = new Map<string, { n: number; v: number }>()
  for (const l of (mix.data ?? []) as unknown as { line_total: number; wt: { name: string } | null }[]) {
    const k = l.wt?.name ?? 'Other'
    const s = services.get(k) ?? { n: 0, v: 0 }
    services.set(k, { n: s.n + 1, v: s.v + Number(l.line_total) })
  }
  const referredBy = (leads.data ?? []).map((l) => (l.raw_payload as { referred_by?: string } | null)?.referred_by).find(Boolean)
  const referrer = (refsIn.data as unknown as { status: string; referrer: { id: string; name: string } | null } | null)
  const made = refsOut.data ?? []
  const avail = (rewards.data ?? []).filter((r) => r.status === 'available')
  const s = sum.data
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="min-w-0 space-y-6">
        <Panel title="Requirements">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="eyebrow text-muted-ink">Needs now</dt><dd className="mt-1 whitespace-pre-line text-ink">{acc.current_requirements ?? <span className="text-muted-ink">Not recorded yet</span>}</dd></div>
            <div><dt className="eyebrow text-muted-ink">Later / pipeline</dt><dd className="mt-1 whitespace-pre-line text-ink">{acc.future_requirements ?? <span className="text-muted-ink">Not recorded yet</span>}</dd></div>
          </dl>
        </Panel>
        <Panel title="Services taken">
          {services.size ? (
            <ul className="divide-y divide-line text-sm">
              {[...services].sort((x, y) => y[1].v - x[1].v).map(([name, v]) => (
                <li key={name} className="flex items-center justify-between py-2"><span className="text-ink">{name}</span><span className="num text-muted-ink">{v.n} fittings · <Money value={v.v.toFixed(0)} paise="never" /></span></li>
              ))}
              <li className="flex items-center justify-between py-2 font-semibold"><span>Approved in all</span><span className="num"><Money value={Number(s?.approved_value ?? 0).toFixed(0)} paise="never" />{Number(s?.discount_total ?? 0) > 0 && <span className="ml-2 text-xs font-normal text-muted-ink">after <Money value={Number(s?.discount_total).toFixed(0)} paise="never" /> discount</span>}</span></li>
            </ul>
          ) : <p className="text-sm text-muted-ink">No approved work yet. Once a proposal is approved, the mix of restore, repair and replace shows here.</p>}
        </Panel>
        <Panel title="Enquiries">
          <ul className="space-y-1 text-sm">
            {(leads.data ?? []).toReversed().map((l) => <Row key={l.id} href={`/staff/leads/${l.id}`} label={`${formatWhen(l.created_at, false)} · ${(l.source as unknown as { name: string } | null)?.name ?? ''}`} right={words(l.status)} />)}
            {!leads.data?.length && <li className="text-muted-ink">No enquiries linked.</li>}
          </ul>
        </Panel>
      </div>
      <div className="min-w-0 space-y-5">
        <Panel title="Profile">
          <dl className="space-y-2 text-sm">
            <Item label="First came via" value={s?.first_source ? `${s.first_source}${s.first_enquiry_at ? ` · ${formatWhen(s.first_enquiry_at, false)}` : ''}` : '—'} />
            <Item label="Size" value={acc.size_units ? `${acc.size_units} rooms` : '—'} />
            <Item label="GSTIN" value={acc.gstin ?? '—'} />
            <Item label="Website" value={acc.website ? <a className="inline-flex items-center gap-1 text-redux-blue hover:underline" href={/^https?:/.test(acc.website) ? acc.website : `https://${acc.website}`} target="_blank" rel="noreferrer"><Globe className="size-3.5" aria-hidden />{acc.website}</a> : '—'} />
            <Item label="Open service requests" value={String(s?.open_service_requests ?? 0)} />
          </dl>
        </Panel>
        <Panel title={`Contacts (${contacts.data?.length ?? 0})`}>
          <ul className="space-y-3 text-sm">
            {(contacts.data ?? []).map((c) => (
              <li key={c.id} className={c.is_active === false ? 'opacity-50' : undefined}>
                <p className="font-medium text-ink">{c.name}{c.is_admin && <span className="ml-1.5 rounded-sm bg-surface px-1.5 text-[11px] text-muted-ink">admin</span>}{c.user_id && <span className="ml-1.5 text-[11px] text-success">portal</span>}{c.is_active === false && <span className="ml-1.5 text-[11px] text-muted-ink">removed</span>}</p>
                <p className="num text-xs text-muted-ink">{c.phone}{c.email ? ` · ${c.email}` : ''}{c.role_title ? ` · ${c.role_title}` : ''}</p>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={`Sites (${properties.data?.length ?? 0})`}>
          {(properties.data ?? []).length ? (
            <ul className="space-y-3 text-sm">
              {(properties.data ?? []).map((p) => (
                <li key={p.id} className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-redux-blue" aria-hidden />
                  <span><span className="block font-medium text-ink">{p.name}</span><span className="text-xs text-muted-ink">{p.address}</span></span></li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-ink">No site yet — one is added when an assessment is booked.</p>}
        </Panel>
        <Panel title="Demos" action={<ProposeDemoButton customerId={id} leadId={openLead?.id ?? null} offer={null} tier={acc.tier} candidates={candidates} />}>
          {demos.data?.length ? (
            <ul className="space-y-2 text-sm">
              {((demos.data ?? []) as unknown as { id: string; demo_no: string; status: string; scheduled_for: string | null; type: { name: string } | null }[]).map((d) => (
                <li key={d.id} className="flex justify-between gap-2"><Link href={`/staff/demos/${d.id}`} className="text-redux-blue hover:underline">{d.type?.name} <span className="num">{d.demo_no}</span></Link>
                  <span className="text-xs text-muted-ink">{DEMO_STATUS[d.status]?.label}{d.scheduled_for ? ` · ${formatWhen(d.scheduled_for, false)}` : ''}</span></li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-ink">No demo yet.{acc.tier === 'A' ? ' Tier A accounts are offered a free room demo.' : acc.tier === 'B' ? ' Tier B accounts are offered a free single-fitting demo.' : ''}</p>}
        </Panel>
        <Panel title="Referrals" action={referrer ? null : <LinkReferral leadId={openLead?.id ?? null} customerId={id} accounts={accounts.data ?? []} hint={referredBy ?? ''} label="Who referred them?" />}>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted-ink">Their code</dt><dd className="num font-semibold text-redux-blue">{code.data ?? '—'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-ink">Referred by</dt><dd className="text-right">{referrer?.referrer
              ? <Link href={`/staff/accounts/${referrer.referrer.id}`} className="text-redux-blue hover:underline">{referrer.referrer.name}</Link>
              : referredBy ? <span className="text-muted-ink">said “{referredBy}” — not linked</span> : '—'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-ink">They referred</dt><dd className="num">{made.length}{made.length ? ` · ${made.filter((r) => r.status !== 'pending').length} ordered` : ''}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-ink">Rewards to use</dt><dd className="num">{avail.length ? avail.map((r) => r.kind === 'credit' ? `₹${Math.round(Number(r.amount)).toLocaleString('en-IN')} credit` : 'free fitting').join(' · ') : '—'}</dd></div>
          </dl>
          {(made.length > 0 || avail.length > 0) && <Link href="/staff/referrals" className="mt-3 inline-block text-xs font-medium text-redux-blue hover:underline">Referral programme →</Link>}
        </Panel>
      </div>
    </div>
  )
}

async function timeline({ id, supabase }: Ctx) {
  const { data } = await supabase.from('v_account_timeline').select('kind, title, detail, actor_id, occurred_at, entity_type, entity_id').eq('customer_id', id).order('occurred_at', { ascending: false }).limit(120)
  const actorIds = [...new Set((data ?? []).map((t) => t.actor_id).filter(Boolean))] as string[]
  const { data: actors } = actorIds.length ? await supabase.from('profiles').select('id, full_name').in('id', actorIds) : { data: [] }
  const items: TimelineItem[] = (data ?? []).map((t, i) => ({
    id: `${t.entity_id}-${t.kind}-${i}`, icon: ICON[t.kind ?? ''] ?? ClipboardList, at: t.occurred_at!, title: t.title,
    body: t.detail ?? undefined, actor: actors?.find((p) => p.id === t.actor_id)?.full_name ?? null,
  }))
  return (
    <Panel title="Timeline" action={<ActivityButton customerId={id} />}>
      {items.length ? <Timeline items={items} /> : <p className="text-sm text-muted-ink">Nothing yet. Enquiries, assessments, proposals, work, payments and messages appear here as they happen.</p>}
    </Panel>
  )
}

async function work({ id, supabase, isAdmin }: Ctx) {
  const [quotes, jobs, invoices] = await Promise.all([
    supabase.from('quotations').select('id, quote_no, version, status, total, discount_amount, issued_at, created_at').eq('customer_id', id).neq('status', 'superseded').order('created_at', { ascending: false }),
    supabase.from('jobs').select('id, job_no, status, actual_start, actual_end, property:properties(name)').eq('customer_id', id).order('created_at', { ascending: false }),
    supabase.from('invoices').select('id, invoice_no, issue_date, total, amount_paid, status, payments(id, amount, method, status, captured_at)').eq('customer_id', id).neq('status', 'cancelled').order('created_at', { ascending: false }),
  ])
  const th = 'px-3 py-2 text-left text-xs font-semibold text-muted-ink'
  const td = 'px-3 py-2'
  return (
    <div className="space-y-6">
      <Panel title="Proposals">
        {quotes.data?.length ? (
          <table className="w-full min-w-[34rem] text-sm"><thead><tr className="border-b border-line"><th className={th}>Quotation</th><th className={th}>Sent</th><th className={th}>Status</th><th className={`${th} text-right`}>Discount</th><th className={`${th} text-right`}>Total</th></tr></thead>
            <tbody>{quotes.data.map((q) => (
              <tr key={q.id} className="border-b border-line last:border-0">
                <td className={td}><Link className="font-medium text-redux-blue hover:underline" href={`/staff/quotes/${q.id}`}>{q.quote_no} v{q.version}</Link></td>
                <td className={`${td} text-muted-ink`}>{q.issued_at ? formatWhen(q.issued_at, false) : '—'}</td>
                <td className={`${td} capitalize`}>{words(q.status)}</td>
                <td className={`${td} num text-right`}>{Number(q.discount_amount) > 0 ? <Money value={q.discount_amount} paise="never" /> : '—'}</td>
                <td className={`${td} num text-right font-semibold`}><Money value={q.total} paise="never" /></td>
              </tr>))}</tbody></table>
        ) : <p className="text-sm text-muted-ink">No proposals yet.</p>}
      </Panel>
      <Panel title="Jobs">
        {jobs.data?.length ? (
          <table className="w-full min-w-[34rem] text-sm"><thead><tr className="border-b border-line"><th className={th}>Job</th><th className={th}>Site</th><th className={th}>Dates</th><th className={th}>Status</th></tr></thead>
            <tbody>{jobs.data.map((j) => (
              <tr key={j.id} className="border-b border-line last:border-0">
                <td className={td}><Link className="font-medium text-redux-blue hover:underline" href={`/staff/jobs/${j.id}`}>{j.job_no}</Link></td>
                <td className={td}>{(j.property as unknown as { name: string } | null)?.name ?? '—'}</td>
                <td className={`${td} text-muted-ink`}>{j.actual_start ? `${formatWhen(j.actual_start, false)} – ${j.actual_end ? formatWhen(j.actual_end, false) : 'ongoing'}` : 'not started'}</td>
                <td className={`${td} capitalize`}>{words(j.status)}</td>
              </tr>))}</tbody></table>
        ) : <p className="text-sm text-muted-ink">No jobs yet.</p>}
      </Panel>
      <Panel title="Invoices & payments">
        {invoices.data?.length ? (
          <table className="w-full min-w-[34rem] text-sm"><thead><tr className="border-b border-line"><th className={th}>Invoice</th><th className={th}>Date</th><th className={th}>Status</th><th className={th}>Payments</th><th className={`${th} text-right`}>Paid / total</th></tr></thead>
            <tbody>{invoices.data.map((i) => {
              const pays = ((i.payments ?? []) as { id: string; amount: number; method: string | null; status: string; captured_at: string | null }[]).filter((p) => p.status === 'captured')
              return (
                <tr key={i.id} className="border-b border-line align-top last:border-0">
                  <td className={td}>{isAdmin ? <Link className="font-medium text-redux-blue hover:underline" href={`/staff/admin/invoices/${i.id}`}>{i.invoice_no ?? 'Draft'}</Link> : <span className="font-medium">{i.invoice_no ?? 'Draft'}</span>}</td>
                  <td className={`${td} text-muted-ink`}>{i.issue_date ? formatWhen(i.issue_date, false) : '—'}</td>
                  <td className={`${td} capitalize`}>{words(i.status)}</td>
                  <td className={`${td} text-xs text-muted-ink`}>{pays.length ? pays.map((p) => <span key={p.id} className="block"><Money value={p.amount} paise="never" /> · {p.method?.toUpperCase() ?? '—'}{p.captured_at ? ` · ${formatWhen(p.captured_at, false)}` : ''}</span>) : '—'}</td>
                  <td className={`${td} num text-right`}><Money value={i.amount_paid} paise="never" /> / <span className="font-semibold"><Money value={i.total} paise="never" /></span></td>
                </tr>)
            })}</tbody></table>
        ) : <p className="text-sm text-muted-ink">No invoices yet.</p>}
      </Panel>
    </div>
  )
}

async function assessments({ id, supabase }: Ctx) {
  const [{ data: props }, { data: jobs }] = await Promise.all([
    supabase.from('properties').select('id').eq('customer_id', id),
    supabase.from('jobs').select('id, job_no, status, actual_end').eq('customer_id', id).eq('status', 'completed').order('actual_end', { ascending: false }),
  ])
  const propIds = (props ?? []).map((p) => p.id)
  const { data: surveys } = propIds.length
    ? await supabase.from('surveys').select('id, status, scheduled_at, submitted_at, property:properties(name), surveyor:profiles!surveys_surveyor_id_fkey(full_name), quotations(status)').in('property_id', propIds).order('scheduled_at', { ascending: false })
    : { data: [] }
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title="Assessments">
        {surveys?.length ? (
          <ul className="divide-y divide-line text-sm">
            {surveys.map((s) => {
              const sent = ((s.quotations ?? []) as { status: string }[]).some((q) => !['draft', 'pending_approval'].includes(q.status))
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span><Link href={`/staff/surveys/${s.id}`} className="font-medium text-redux-blue hover:underline">{(s.property as unknown as { name: string } | null)?.name ?? 'Site'}</Link>
                    <span className="block text-xs text-muted-ink">{formatWhen(s.submitted_at ?? s.scheduled_at, false)} · {(s.surveyor as unknown as { full_name: string } | null)?.full_name ?? 'unassigned'} · {words(s.status)}</span></span>
                  {s.status === 'submitted' && sent ? <ReportLink href={`/staff/reports/assessment/${s.id}`}>Assessment report</ReportLink> : <span className="text-xs text-muted-ink">{s.status === 'submitted' ? 'report once the proposal is sent' : ''}</span>}
                </li>)
            })}
          </ul>
        ) : <p className="text-sm text-muted-ink">No assessments yet.</p>}
      </Panel>
      <Panel title="Completion reports & warranties">
        {jobs?.length ? (
          <ul className="divide-y divide-line text-sm">
            {jobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span><Link href={`/staff/jobs/${j.id}`} className="font-medium text-redux-blue hover:underline">Job {j.job_no}</Link><span className="block text-xs text-muted-ink">completed {j.actual_end ? formatWhen(j.actual_end, false) : ''}</span></span>
                <span className="flex gap-2"><ReportLink href={`/staff/reports/completion/${j.id}`}>Completion</ReportLink><ReportLink href={`/staff/reports/warranty/${j.id}`}>Warranty</ReportLink></span>
              </li>))}
          </ul>
        ) : <p className="text-sm text-muted-ink">Reports appear here once a job is completed.</p>}
      </Panel>
    </div>
  )
}

async function comms({ id, supabase }: Ctx) {
  const { data: leads } = await supabase.from('leads').select('id').eq('customer_id', id)
  const leadIds = (leads ?? []).map((l) => l.id)
  const [fu, convs, sent] = await Promise.all([
    leadIds.length ? supabase.from('follow_ups').select('id, lead_id, due_at, note, completed_at, who:profiles!follow_ups_assigned_to_fkey(full_name)').in('lead_id', leadIds).order('due_at', { ascending: false }).limit(40) : Promise.resolve({ data: [] }),
    supabase.from('whatsapp_conversations').select('id').or(leadIds.length ? `customer_id.eq.${id},lead_id.in.(${leadIds.join(',')})` : `customer_id.eq.${id}`),
    supabase.from('messages').select('id, channel, template_code, status, queued_at').eq('customer_id', id).neq('category', 'authentication').order('queued_at', { ascending: false }).limit(30),
  ])
  const convIds = (convs.data ?? []).map((c) => c.id)
  const { data: wa } = convIds.length
    ? await supabase.from('whatsapp_messages').select('id, direction, body, template_code, occurred_at').in('conversation_id', convIds).order('occurred_at', { ascending: false }).limit(40)
    : { data: [] }
  const follow = (fu.data ?? []) as unknown as { id: string; lead_id: string; due_at: string; note: string | null; completed_at: string | null; who: { full_name: string } | null }[]
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="min-w-0 space-y-6">
        <Panel title="Follow-ups">
          {follow.length ? (
            <ul className="divide-y divide-line text-sm">
              {follow.map((f) => {
                const late = !f.completed_at && new Date(f.due_at).getTime() < nowMs()
                return (
                  <li key={f.id} className="flex items-start justify-between gap-3 py-2.5">
                    <span><Link href={`/staff/leads/${f.lead_id}`} className="text-ink hover:underline">{f.note ?? 'Follow-up'}</Link><span className="block text-xs text-muted-ink">{f.who?.full_name ?? '—'}</span></span>
                    <span className={`shrink-0 text-xs ${f.completed_at ? 'text-success' : late ? 'font-semibold text-danger' : 'text-muted-ink'}`}>{f.completed_at ? `done ${formatWhen(f.completed_at, false)}` : `${late ? 'overdue · ' : 'due '}${formatWhen(f.due_at)}`}</span>
                  </li>)
              })}
            </ul>
          ) : <p className="text-sm text-muted-ink">No follow-ups on this account’s enquiries.</p>}
        </Panel>
        <Panel title="Messages we sent">
          {sent.data?.length ? (
            <ul className="divide-y divide-line text-sm">
              {sent.data.map((m) => <li key={m.id} className="flex justify-between gap-3 py-2"><span className="text-ink capitalize">{words(m.template_code ?? m.channel)}</span><span className="text-xs text-muted-ink">{words(m.status)} · {formatRelative(m.queued_at)}</span></li>)}
            </ul>
          ) : <p className="text-sm text-muted-ink">No messages sent yet.</p>}
        </Panel>
      </div>
      <Panel title="WhatsApp conversation">
        {wa?.length ? (
          <ul className="space-y-2.5">
            {wa.map((m) => (
              <li key={m.id} className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.direction === 'inbound' ? 'bg-surface text-ink' : 'ml-auto bg-pale text-ink'}`}>
                <p className="whitespace-pre-line">{m.body ?? (m.template_code ? `Template: ${words(m.template_code)}` : '—')}</p>
                <p className="mt-1 text-[11px] text-muted-ink">{m.direction === 'inbound' ? 'Customer' : 'REDUX'} · {formatWhen(m.occurred_at)}</p>
              </li>))}
          </ul>
        ) : <p className="text-sm text-muted-ink">No WhatsApp conversation with this account yet.</p>}
      </Panel>
    </div>
  )
}

function Fact({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return <div className="rounded-lg border border-line bg-white p-3.5 shadow-card"><p className="eyebrow text-muted-ink">{label}</p><p className="num mt-1 text-base font-semibold text-ink">{value}</p>{hint && <p className="mt-0.5 text-xs text-muted-ink">{hint}</p>}</div>
}
function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex justify-between gap-3"><dt className="text-muted-ink">{label}</dt><dd className="text-right text-ink">{value}</dd></div>
}
function Row({ href, label, right }: { href: string; label: string; right: React.ReactNode }) {
  return <li><Link href={href} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-surface"><span className="text-ink">{label}</span><span className="text-xs text-muted-ink capitalize">{right}</span></Link></li>
}
function ReportLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-redux-blue ring-1 ring-line hover:bg-surface"><FileText className="size-3.5" aria-hidden />{children}</Link>
}
