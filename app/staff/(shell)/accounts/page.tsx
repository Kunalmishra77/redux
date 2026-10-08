import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2, ShieldCheck } from 'lucide-react'
import { EmptyState, formatRelative, PageHeader, StatusPill } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Accounts' }

type Row = {
  id: string; name: string; kind: string; tier: string | null; is_prospect: boolean; verified_at: string | null; created_at: string
  segment: { name: string } | null; group: { name: string } | null; owner: { full_name: string } | null
  properties: { id: string }[]; jobs: { id: string }[]
}

// E18-S07 (D24) — every business account: segment, group, tier, owner, verification. RLS decides
// which accounts an executive sees (converted accounts + prospects of their own leads).
export default async function AccountsPage({ searchParams }: PageProps<'/staff/accounts'>) {
  await requireRole(['super_admin', 'cc_exec'])
  const sp = await searchParams
  const q = typeof sp.q === 'string' ? sp.q.trim() : ''
  const segment = typeof sp.segment === 'string' ? sp.segment : ''
  const stage = typeof sp.stage === 'string' ? sp.stage : ''
  const supabase = await createClient()
  let query = supabase.from('customers')
    .select('id, name, kind, tier, is_prospect, verified_at, created_at, segment:segments(name), group:customer_groups(name), owner:profiles!customers_account_owner_id_fkey(full_name), properties(id), jobs(id)')
    .eq('kind', 'business')
    .order('name')
  if (q) query = query.ilike('name', `%${q}%`)
  if (segment) query = query.eq('segment_id', segment)
  if (stage === 'prospect') query = query.eq('is_prospect', true)
  if (stage === 'customer') query = query.eq('is_prospect', false)
  if (stage === 'unverified') query = query.is('verified_at', null)
  const [{ data }, { data: segments }] = await Promise.all([
    query,
    supabase.from('segments').select('id, name').eq('is_b2c', false).eq('is_active', true).order('sort_order'),
  ])
  const rows = (data ?? []) as unknown as Row[]
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
            <option value="">All</option><option value="prospect">Prospects</option><option value="customer">Customers</option><option value="unverified">Not verified</option>
          </select></label>
        <button type="submit" className="h-10 rounded-md bg-redux-blue px-4 text-sm font-semibold text-white">Apply</button>
      </form>
      {rows.length === 0 ? (
        <EmptyState icon={Building2} title="No accounts match" body="An account is created when a business registers, enquires and books an assessment, or is added by the team." />
      ) : (
        <div className="relative overflow-x-auto rounded-lg border border-line bg-white shadow-card">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line bg-surface text-left">
              {['Account', 'Segment', 'Tier', 'Owner', 'Sites', 'Jobs', 'Stage'].map((h, i) => <th key={h} className={`eyebrow px-4 py-3 text-muted-ink ${i === 4 || i === 5 ? 'text-right' : ''}`}>{h}</th>)}
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
                  <td className="num px-4 py-3 text-right">{r.properties.length}</td>
                  <td className="num px-4 py-3 text-right">{r.jobs.length}</td>
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
