import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  Banknote, CalendarCheck, ClipboardList, FileText, Hammer, LifeBuoy, MapPin, MessageCircle, Phone, Receipt, ShieldCheck,
  StickyNote, Users,
} from 'lucide-react'
import { formatWhen, Money, PageHeader, Panel, StatusPill, Timeline, type TimelineItem } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { AccountActions, ActivityButton } from './account-actions'

export const metadata: Metadata = { title: 'Account' }

const ICON: Record<string, LucideIcon> = {
  lead_status: ClipboardList, call: Phone, note: StickyNote, survey: CalendarCheck, quotation: FileText, approval: ShieldCheck,
  job_stage: Hammer, invoice: Receipt, payment: Banknote, service_request: LifeBuoy, message: MessageCircle, activity: Users,
}

// E18-S07 (D24) — one business, everything about it: profile, contacts, sites, enquiries, money and
// the account timeline (ADR-017). Richer profiling (score breakdown, referrals, offers) is phase 3.
export default async function AccountPage({ params }: PageProps<'/staff/accounts/[id]'>) {
  const user = await requireRole(['super_admin', 'cc_exec'])
  const { id } = await params
  const supabase = await createClient()
  const { data: a } = await supabase.from('customers')
    .select('id, name, legal_name, kind, tier, size_units, is_prospect, converted_at, verified_at, gstin, billing_address, created_at, segment_id, group_id, account_owner_id, segment:segments(name), group:customer_groups(name), owner:profiles!customers_account_owner_id_fkey(full_name)')
    .eq('id', id).maybeSingle()
  if (!a) notFound()
  const acc = a as unknown as typeof a & { segment: { name: string } | null; group: { name: string } | null; owner: { full_name: string } | null }
  const [contacts, properties, leads, quotes, jobs, invoices, timeline, segments, groups, staff] = await Promise.all([
    supabase.from('customer_contacts').select('id, name, phone, email, role_title, role_code, is_admin, is_primary, user_id').eq('customer_id', id).order('is_primary', { ascending: false }),
    supabase.from('properties').select('id, name, address, city:cities(name)').eq('customer_id', id),
    supabase.from('leads').select('id, status, created_at, source:lead_sources(name)').eq('customer_id', id).order('created_at', { ascending: false }),
    supabase.from('quotations').select('id, quote_no, version, status, total').eq('customer_id', id).neq('status', 'superseded').order('created_at', { ascending: false }),
    supabase.from('jobs').select('id, job_no, status').eq('customer_id', id).order('created_at', { ascending: false }),
    supabase.from('invoices').select('id, total, amount_paid, status').eq('customer_id', id).neq('status', 'cancelled'),
    supabase.from('v_account_timeline').select('kind, title, detail, actor_id, occurred_at, entity_type, entity_id').eq('customer_id', id).order('occurred_at', { ascending: false }).limit(60),
    supabase.from('segments').select('id, name').eq('is_b2c', false).eq('is_active', true).order('sort_order'),
    supabase.from('customer_groups').select('id, name').order('name'),
    supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name'),
  ])
  const actorIds = [...new Set((timeline.data ?? []).map((t) => t.actor_id).filter(Boolean))] as string[]
  const { data: actors } = actorIds.length ? await supabase.from('profiles').select('id, full_name').in('id', actorIds) : { data: [] }
  const items: TimelineItem[] = (timeline.data ?? []).map((t, i) => ({
    id: `${t.entity_id}-${t.kind}-${i}`, icon: ICON[t.kind ?? ''] ?? ClipboardList, at: t.occurred_at!, title: t.title,
    body: t.detail ?? undefined, actor: actors?.find((p) => p.id === t.actor_id)?.full_name ?? null,
  }))
  const inv = invoices.data ?? []
  const billed = inv.reduce((s, x) => s + Number(x.total), 0)
  const paid = inv.reduce((s, x) => s + Number(x.amount_paid), 0)
  const isAdmin = user.role === 'super_admin'

  return (
    <>
      <PageHeader back={{ href: '/staff/accounts', label: 'Accounts' }} title={acc.name}
        description={[acc.legal_name && acc.legal_name !== acc.name ? acc.legal_name : null, acc.segment?.name, acc.group?.name ? `part of ${acc.group.name}` : null].filter(Boolean).join(' · ') || undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={acc.is_prospect ? 'waiting' : 'positive'}>{acc.is_prospect ? 'Prospect' : 'Customer'}</StatusPill>
            {acc.verified_at ? <StatusPill tone="positive">Verified</StatusPill> : <StatusPill tone="neutral">Not verified</StatusPill>}
            {acc.tier && <span className="num rounded-sm bg-pale px-2 py-1 text-xs font-bold text-redux-blue">Tier {acc.tier}</span>}
            {isAdmin && (
              <AccountActions id={id} verified={!!acc.verified_at}
                profile={{ legal_name: acc.legal_name ?? '', segment_id: acc.segment_id, group_id: acc.group_id, account_owner_id: acc.account_owner_id, size_units: acc.size_units }}
                segments={segments.data ?? []} groups={groups.data ?? []} staff={staff.data ?? []} />
            )}
          </div>
        } />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Fact label="Account owner" value={acc.owner?.full_name ?? 'Not assigned'} />
        <Fact label="Size" value={acc.size_units ? `${acc.size_units} rooms` : '—'} />
        <Fact label="Billed / paid" value={<><Money value={billed.toFixed(0)} paise="never" /> / <Money value={paid.toFixed(0)} paise="never" /></>} />
        <Fact label="Since" value={formatWhen(acc.created_at, false)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <Panel title="Timeline" action={<ActivityButton customerId={id} />}>
            {items.length ? <Timeline items={items} /> : <p className="text-sm text-muted-ink">Nothing yet. Enquiries, assessments, proposals, work and payments appear here as they happen.</p>}
          </Panel>
        </div>
        <div className="min-w-0 space-y-5">
          <Panel title={`Contacts (${contacts.data?.length ?? 0})`}>
            <ul className="space-y-3 text-sm">
              {(contacts.data ?? []).map((c) => (
                <li key={c.id}>
                  <p className="font-medium text-ink">{c.name}{c.is_admin && <span className="ml-1.5 rounded-sm bg-surface px-1.5 text-[11px] text-muted-ink">admin</span>}{c.user_id && <span className="ml-1.5 text-[11px] text-success">portal</span>}</p>
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
          <Panel title="Enquiries, proposals & work">
            <ul className="space-y-2 text-sm">
              {(leads.data ?? []).map((l) => <Row key={l.id} href={`/staff/leads/${l.id}`} label={`Enquiry · ${(l.source as unknown as { name: string } | null)?.name ?? ''}`} right={l.status.replace('_', ' ')} />)}
              {(quotes.data ?? []).map((q) => <Row key={q.id} href={`/staff/quotes/${q.id}`} label={`${q.quote_no} v${q.version}`} right={<><Money value={q.total} paise="never" /> · {q.status.replace('_', ' ')}</>} />)}
              {(jobs.data ?? []).map((j) => <Row key={j.id} href={`/staff/jobs/${j.id}`} label={`Job ${j.job_no}`} right={j.status.replace('_', ' ')} />)}
              {!(leads.data?.length || quotes.data?.length || jobs.data?.length) && <li className="text-muted-ink">Nothing yet.</li>}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  )
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-lg border border-line bg-white p-4 shadow-card"><p className="eyebrow text-muted-ink">{label}</p><p className="mt-1 text-base font-semibold text-ink">{value}</p></div>
}
function Row({ href, label, right }: { href: string; label: string; right: React.ReactNode }) {
  return <li><Link href={href} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-surface"><span className="text-ink">{label}</span><span className="text-xs text-muted-ink capitalize">{right}</span></Link></li>
}
