import type { Metadata } from 'next'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Banknote, CalendarCheck, ClipboardList, FileText, Hammer, Lock, LifeBuoy, MessageCircle, Receipt, ShieldCheck } from 'lucide-react'
import { formatWhen, JOB_STAGES, Money, StatusPill, Timeline, type TimelineItem } from '@/components/patterns'
import { createClient } from '@/lib/supabase/server'
import { requirePortalUser, type PortalUser } from '@/lib/data/portal'
import { RepeatButton } from '../repeat-button'

export const metadata: Metadata = { title: 'History' }

const TABS = [
  ['all', 'Everything'], ['assessments', 'Assessments'], ['proposals', 'Proposals'], ['work', 'Work done'],
  ['money', 'Invoices & payments'], ['service', 'Service'],
] as const
type Tab = (typeof TABS)[number][0]

const ICON: Record<string, LucideIcon> = {
  lead_status: ClipboardList, survey: CalendarCheck, quotation: FileText, approval: ShieldCheck, job_stage: Hammer,
  invoice: Receipt, payment: Banknote, service_request: LifeBuoy, message: MessageCircle,
}

// CR-001 phase 2 (D25) — the account's complete history from the same records the REDUX team sees
// (ADR-017). Unverified accounts see enquiry-stage records; the rest opens after verification (BR-B2).
type Ctx = { supabase: Awaited<ReturnType<typeof createClient>>; user: PortalUser; accountName: (id: string | null) => string | null }

export default async function HistoryPage({ searchParams }: PageProps<'/portal/history'>) {
  const user = await requirePortalUser()
  const sp = await searchParams
  const tab: Tab = (TABS.find(([k]) => k === sp.tab)?.[0] ?? 'all') as Tab
  const supabase = await createClient()
  const multi = user.customers.length > 1
  const accountName = (id: string | null) => (multi && id ? user.customers.find((c) => c.id === id)?.name ?? null : null)
  const ctx: Ctx = { supabase, user, accountName }
  const content =
    tab === 'assessments' ? await assessments(ctx)
    : tab === 'proposals' ? await proposals(ctx)
    : tab === 'work' ? (user.verified ? await work(ctx) : <Locked />)
    : tab === 'money' ? (user.verified ? await money(ctx) : <Locked />)
    : tab === 'service' ? await service(ctx)
    : await everything(ctx)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">History</h1>
        <p className="mt-1 text-sm text-muted-ink">Every assessment, proposal, job, invoice and request{multi ? ' across your accounts' : ''}.</p>
      </div>
      {!user.verified && (
        <p className="flex items-start gap-2 rounded-lg border border-line bg-white px-4 py-3 text-sm text-muted-ink">
          <Lock className="mt-0.5 size-4 shrink-0 text-redux-blue" aria-hidden />
          Your account is being verified by REDUX. Your enquiries, assessments and proposals are here now; work history, invoices and reports open once it’s verified.
        </p>
      )}
      <nav className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1" aria-label="History">
        {TABS.map(([k, label]) => (
          <Link key={k} href={k === 'all' ? '/portal/history' : `/portal/history?tab=${k}`}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${tab === k ? 'bg-redux-blue text-white' : 'bg-white text-muted-ink ring-1 ring-line hover:text-ink'}`}>{label}</Link>
        ))}
      </nav>
      {content}
    </div>
  )
}

async function everything({ supabase, user, accountName }: Ctx) {
  const { data } = await supabase.from('v_account_timeline').select('customer_id, kind, title, occurred_at, entity_id')
    .neq('kind', 'message').order('occurred_at', { ascending: false }).limit(80)
  const items: TimelineItem[] = (data ?? [])
    .filter((t) => user.verified || !['job_stage', 'invoice', 'payment'].includes(t.kind ?? ''))
    .map((t, i) => ({ id: `${t.entity_id}-${i}`, icon: ICON[t.kind ?? ''] ?? ClipboardList, at: t.occurred_at!, title: t.title, actor: accountName(t.customer_id) }))
  return <Card>{items.length ? <Timeline items={items} /> : <Empty text="Your history starts with your first enquiry." />}</Card>
}

async function assessments({ supabase, user, accountName }: Ctx) {
  const { data } = await supabase.from('surveys').select('id, status, scheduled_at, submitted_at, property:properties(name, customer_id), quotations(id, status)').order('scheduled_at', { ascending: false })
  const rows = (data ?? []) as unknown as { id: string; status: string; scheduled_at: string; submitted_at: string | null; property: { name: string; customer_id: string } | null; quotations: { id: string; status: string }[] }[]
  if (!rows.length) return <Card><Empty text="No assessments yet." /></Card>
  return (
    <ul className="space-y-3">
      {rows.map((s) => {
        const sent = s.quotations.some((q) => q.status !== 'draft' && q.status !== 'pending_approval')
        return (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-4 shadow-card">
            <div><p className="font-semibold text-ink">{s.property?.name}</p>
              <p className="text-sm text-muted-ink">{s.status === 'submitted' ? `Completed ${formatWhen(s.submitted_at ?? s.scheduled_at, false)}` : `Booked for ${formatWhen(s.scheduled_at)}`}{accountName(s.property?.customer_id ?? null) ? ` · ${accountName(s.property!.customer_id)}` : ''}</p></div>
            {s.status === 'submitted' && sent && user.verified
              ? <Link href={`/portal/reports/assessment/${s.id}`} className="text-sm font-semibold text-redux-blue hover:underline">Assessment report →</Link>
              : <StatusPill tone={s.status === 'submitted' ? 'positive' : 'progress'}>{s.status === 'submitted' ? 'Completed' : 'Scheduled'}</StatusPill>}
          </li>
        )
      })}
    </ul>
  )
}

async function proposals({ supabase }: Ctx) {
  const { data } = await supabase.from('quotations').select('id, quote_no, version, status, total, you_save, issued_at, customer_id').neq('status', 'superseded').order('created_at', { ascending: false })
  if (!data?.length) return <Card><Empty text="No proposals yet — they follow an assessment." /></Card>
  return (
    <ul className="space-y-3">
      {data.map((q) => (
        <li key={q.id}>
          <Link href={`/portal/quotes/${q.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-4 shadow-card hover:border-redux-blue/40">
            <div><p className="num font-semibold text-ink">{q.quote_no} v{q.version}</p>
              <p className="text-sm text-muted-ink"><Money value={q.total} paise="never" /> · you save <Money value={q.you_save} paise="never" />{q.issued_at ? ` · ${formatWhen(q.issued_at, false)}` : ''}</p></div>
            <StatusPill tone={q.status === 'approved' ? 'positive' : q.status === 'sent' ? 'progress' : 'neutral'}>{q.status === 'sent' ? 'Awaiting your approval' : q.status.replace('_', ' ')}</StatusPill>
          </Link>
        </li>
      ))}
    </ul>
  )
}

async function work({ supabase }: Ctx) {
  const { data } = await supabase.from('jobs').select('id, job_no, status, current_stage, actual_start, actual_end, property_id, property:properties(name), units:job_units(id)').order('created_at', { ascending: false })
  const rows = (data ?? []) as unknown as { id: string; job_no: string; status: string; current_stage: string; actual_start: string | null; actual_end: string | null; property_id: string; property: { name: string } | null; units: { id: string }[] }[]
  if (!rows.length) return <Card><Empty text="No work yet." /></Card>
  return (
    <ul className="space-y-3">
      {rows.map((j) => (
        <li key={j.id} className="rounded-xl border border-line bg-white p-4 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><Link href={`/portal/jobs/${j.id}`} className="font-semibold text-ink hover:text-redux-blue">{j.property?.name} · <span className="num">{j.job_no}</span></Link>
              <p className="text-sm text-muted-ink">{j.units.length} rooms · {j.status === 'completed' ? `completed ${j.actual_end ? formatWhen(j.actual_end, false) : ''}` : JOB_STAGES.find((s) => s.key === j.current_stage)?.label}</p></div>
            <StatusPill tone={j.status === 'completed' ? 'positive' : 'progress'}>{j.status === 'completed' ? 'Completed' : 'In progress'}</StatusPill>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3 text-sm">
            <Link href="/portal/fittings" className="font-medium text-redux-blue hover:underline">Before &amp; after</Link>
            {j.status === 'completed' && <Link href={`/portal/reports/completion/${j.id}`} className="font-medium text-redux-blue hover:underline">Completion report</Link>}
            {j.status === 'completed' && <Link href={`/portal/reports/warranty/${j.id}`} className="font-medium text-redux-blue hover:underline">Warranty certificate</Link>}
            <span className="ml-auto"><RepeatButton jobId={j.id} propertyName={j.property?.name ?? ''} /></span>
          </div>
        </li>
      ))}
    </ul>
  )
}

async function money({ supabase }: Ctx) {
  const [{ data: invoices }, { data: payments }] = await Promise.all([
    supabase.from('invoices').select('id, invoice_no, status, issue_date, total, amount_paid').neq('status', 'draft').order('issue_date', { ascending: false }),
    supabase.from('payments').select('id, amount, method, captured_at, invoice:invoices(invoice_no)').eq('status', 'captured').order('captured_at', { ascending: false }),
  ])
  if (!invoices?.length) return <Card><Empty text="No invoices yet." /></Card>
  return (
    <div className="space-y-5">
      <ul className="space-y-3">
        {invoices.map((i) => (
          <li key={i.id}><Link href={`/portal/invoices/${i.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-4 shadow-card hover:border-redux-blue/40">
            <div><p className="num font-semibold text-ink">{i.invoice_no}</p><p className="text-sm text-muted-ink">{i.issue_date ? formatWhen(i.issue_date, false) : ''} · <Money value={i.total} paise="never" /></p></div>
            <StatusPill tone={i.status === 'paid' ? 'positive' : 'waiting'}>{i.status === 'paid' ? 'Paid' : i.status === 'part_paid' ? 'Part paid' : 'Due'}</StatusPill>
          </Link></li>
        ))}
      </ul>
      {(payments?.length ?? 0) > 0 && (
        <Card title="Payments">
          <ul className="divide-y divide-line text-sm">
            {payments!.map((p) => <li key={p.id} className="flex justify-between gap-3 py-2"><span className="text-ink">{(p.invoice as unknown as { invoice_no: string } | null)?.invoice_no} · {String(p.method ?? '').toUpperCase()}</span><span><Money value={p.amount} paise="never" /> · <span className="text-muted-ink">{p.captured_at ? formatWhen(p.captured_at, false) : ''}</span></span></li>)}
          </ul>
        </Card>
      )}
    </div>
  )
}

async function service({ supabase }: Ctx) {
  const { data } = await supabase.from('service_requests').select('id, request_no, subject, status, created_at').order('created_at', { ascending: false })
  if (!data?.length) return <Card><Empty text="No service requests." /></Card>
  return (
    <ul className="space-y-3">
      {data.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-4 shadow-card">
          <div><p className="font-semibold text-ink">{r.subject}</p><p className="num text-xs text-muted-ink">{r.request_no} · {formatWhen(r.created_at, false)}</p></div>
          <StatusPill tone={r.status === 'resolved' || r.status === 'closed' ? 'positive' : 'waiting'}>{r.status.replace('_', ' ')}</StatusPill>
        </li>
      ))}
    </ul>
  )
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-line bg-white p-5 shadow-card">{title && <h2 className="mb-3 font-semibold text-ink">{title}</h2>}{children}</section>
}
function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-muted-ink">{text}</p>
}
function Locked() {
  return <Card><p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-ink"><Lock className="size-4" aria-hidden /> Opens once REDUX verifies your account.</p></Card>
}
