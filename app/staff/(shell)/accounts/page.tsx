import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2, ShieldCheck } from 'lucide-react'
import { EmptyState, formatRelative, formatWhen, Money, PageHeader, StatusPill } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { nowMs } from '@/lib/services/clock'

export const metadata: Metadata = { title: 'Accounts' }

type Row = {
  id: string; name: string; kind: string; tier: string | null; is_prospect: boolean; verified_at: string | null; created_at: string
  next_action: string | null; next_action_at: string | null
  segment: { name: string } | null; group: { name: string } | null; owner: { full_name: string } | null
  jobs: { id: string }[]
}

// E18-S07 (D24) — every business account: segment, group, tier, owner, verification. RLS decides
// which accounts an executive sees (converted accounts + prospects of their own leads).
export default async function AccountsPage({ searchParams }: PageProps<'/staff/accounts'>) {
  const user = await requireRole(['super_admin', 'cc_exec'])
  const sp = await searchParams
  const q = typeof sp.q === 'string' ? sp.q.trim() : ''
  const segment = typeof sp.segment === 'string' ? sp.segment : ''
  const stage = typeof sp.stage === 'string' ? sp.stage : ''
  const mine = sp.owner === 'me'
  const supabase = await createClient()
  let query = supabase.from('customers')
    .select('id, name, kind, tier, is_prospect, verified_at, created_at, next_action, next_action_at, segment:segments(name), group:customer_groups(name), owner:profiles!customers_account_owner_id_fkey(full_name), jobs(id)')
    .eq('kind', 'business')
    .order('name')
  if (q) query = query.ilike('name', `%${q}%`)
  if (segment) query = query.eq('segment_id', segment)
  if (stage === 'prospect') query = query.eq('is_prospect', true)
  if (stage === 'customer') query = query.eq('is_prospect', false)
  if (stage === 'unverified') query = query.is('verified_at', null)
  if (stage === 'overdue') query = query.lt('next_action_at', new Date(nowMs()).toISOString())
  if (stage === 'no_next') query = query.is('next_action', null)
  if (mine) query = query.eq('account_owner_id', user.id)
  const [{ data }, { data: segments }] = await Promise.all([
    query,
    supabase.from('segments').select('id, name').eq('is_b2c', false).eq('is_active', true).order('sort_order'),
  ])
  const rows = (data ?? []) as unknown as Row[]
  const { data: sums } = rows.length ? await supabase.from('v_account_summary').select('customer_id, lifetime_billed, open_proposal_value').in('customer_id', rows.map((r) => r.id)) : { data: [] }
  const sumBy = new Map((sums ?? []).map((x) => [x.customer_id, x]))
  return (
    <>
      <PageHeader title="Accounts" description="Every business REDUX works with — branches, contacts, enquiries and work in one place." />
      <form className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-white p-4 shadow-card" role="search">
        <label className="grid gap-1 text-sm"><span className="text-muted-ink">Search</span>
          <input name="q" defaultValue={q} placeholder="Business name" className="h-10 w-56 rounded-md border border-line px-3" /></label>
        <label className="grid gap-1 text-sm"><span className="text-muted-ink">Segment</span>
          <select name="segment" defaultValue={segment} className="h-10 w-48 rounded-md border border-line bg-white px-2">
            <option value="">All</option>{(segments ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></label>
        <label className="grid gap-1 text-sm"><span className="text-muted-ink">Stage</span>
          <select name="stage" defaultValue={stage} className="h-10 w-40 rounded-md border border-line bg-white px-2">
            <option value="">All</option><option value="prospect">Prospects</option><option value="customer">Customers</option><option value="unverified">Not verified</option><option value="overdue">Next action overdue</option><option value="no_next">No next action</option>
          </select></label>
        <label className="grid gap-1 text-sm"><span className="text-muted-ink">Owner</span>
          <select name="owner" defaultValue={mine ? 'me' : ''} className="h-10 w-36 rounded-md border border-line bg-white px-2">
            <option value="">Anyone</option><option value="me">My accounts</option>
          </select></label>
        <button type="submit" className="h-10 rounded-md bg-redux-blue px-4 text-sm font-semibold text-white">Apply</button>
      </form>
      {rows.length === 0 ? (
        <EmptyState icon={Building2} title="No accounts match" body="An account is created when a business registers, enquires and books an assessment, or is added by the team." />
      ) : (
        <div className="relative overflow-x-auto rounded-lg border border-line bg-white shadow-card">
          <table className="w-full min-w-[60rem] text-sm">
            <thead><tr className="border-b border-line bg-surface text-left">
              {['Account', 'Segment', 'Tier', 'Owner', 'Billed', 'Open proposals', 'Next action', 'Stage'].map((h, i) => <th key={h} className={`eyebrow px-4 py-3 whitespace-nowrap text-muted-ink ${i === 4 || i === 5 ? 'text-right' : ''}`}>{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-select">
                  <td className="px-4 py-3">
                    <Link href={`/staff/accounts/${r.id}`} className="font-semibold text-ink hover:text-redux-blue">{r.name}</Link>
                    <p className="text-xs text-muted-ink">{r.group?.name ? `${r.group.name} · ` : ''}since {formatRelative(r.created_at)}</p>
                  </td>
                  <td className="px-4 py-3 text-ink">{r.segment?.name ?? '—'}</td>
                  <td className="px-4 py-3">{r.tier ? <span className="num rounded-sm bg-pale px-2 py-0.5 text-xs font-bold text-redux-blue">{r.tier}</span> : <span className="text-faint">—</span>}</td>
                  <td className="px-4 py-3 text-muted-ink">{r.owner?.full_name ?? '—'}</td>
                  <td className="num px-4 py-3 text-right"><Money value={Number(sumBy.get(r.id)?.lifetime_billed ?? 0).toFixed(0)} paise="never" /><p className="text-xs text-muted-ink">{r.jobs.length} {r.jobs.length === 1 ? 'job' : 'jobs'}</p></td>
                  <td className="num px-4 py-3 text-right">{Number(sumBy.get(r.id)?.open_proposal_value ?? 0) > 0 ? <Money value={Number(sumBy.get(r.id)?.open_proposal_value).toFixed(0)} paise="never" /> : <span className="text-faint">—</span>}</td>
                  <td className="max-w-56 px-4 py-3">{r.next_action ? <><p className="truncate text-ink">{r.next_action}</p>{r.next_action_at && <p className={`text-xs ${new Date(r.next_action_at).getTime() < nowMs() ? 'font-semibold text-danger' : 'text-muted-ink'}`}>{formatWhen(r.next_action_at, false)}</p>}</> : <span className="text-faint">—</span>}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <StatusPill tone={r.is_prospect ? 'waiting' : 'positive'}>{r.is_prospect ? 'Prospect' : 'Customer'}</StatusPill>
                      {r.verified_at && <ShieldCheck className="size-4 text-success" aria-label="Verified" />}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
