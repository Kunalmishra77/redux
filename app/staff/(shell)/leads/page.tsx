import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Plus, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState, formatWhen, LEAD_STATUS, PageHeader, StatusPill } from '@/components/patterns'
import { SourceBadge, SlaTimer } from '@/components/features/leads/bits'
import { SOURCES } from '@/lib/constants/sources'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { LEAD_COLUMNS, type LeadRow } from '@/lib/data/leads'

export const metadata: Metadata = { title: 'Leads' }
const PAGE = 25

// B5 — every lead from every source, filterable (D2-01), server-paginated so it stays fast at 50k.
export default async function LeadsPage({ searchParams }: PageProps<'/staff/leads'>) {
  const user = await requireRole(['super_admin', 'cc_exec'])
  const sp = await searchParams
  const get = (k: string) => (typeof sp[k] === 'string' && sp[k] ? (sp[k] as string) : undefined)
  const q = get('q'), source = get('source'), status = get('status'), city = get('city'), owner = get('owner')
  const page = Math.max(1, Number(get('page') ?? 1))
  const supabase = await createClient()

  const [{ data: sources }, { data: cities }, { data: owners }] = await Promise.all([
    supabase.from('lead_sources').select('id, code, name').order('name'),
    supabase.from('cities').select('id, name').order('name'),
    supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name'),
  ])

  let query = supabase.from('leads').select(LEAD_COLUMNS, { count: 'exact' })
  if (user.role === 'cc_exec') query = query.eq('assigned_to', user.id)
  if (q) {
    const term = q.replace(/[%,()]/g, ' ').trim()
    const digits = term.replace(/\D/g, '')
    query = query.or([`name.ilike.%${term}%`, `property_name.ilike.%${term}%`, digits.length >= 4 ? `phone.ilike.%${digits}%` : null].filter(Boolean).join(','))
  }
  if (source) query = query.eq('source_id', sources?.find((s) => s.code === source)?.id ?? '00000000-0000-0000-0000-000000000000')
  if (status) query = query.eq('status', status as LeadRow['status'] as never)
  if (city) query = query.eq('city_id', city)
  if (owner && user.role === 'super_admin') query = query.eq('assigned_to', owner)
  const { data, count } = await query.order('created_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1)
  const leads = (data ?? []) as unknown as LeadRow[]
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE))
  const link = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries({ q, source, status, city, owner, ...over })) if (v) p.set(k, v)
    return `?${p}`
  }

  return (
    <>
      <PageHeader title="Leads" description={<><span className="num font-semibold text-ink">{count ?? 0}</span> {q || source || status || city || owner ? 'matching' : 'in total'} · every channel, one list</>}
        actions={<Button asChild><Link href="/staff/leads/new"><Plus aria-hidden /> New lead</Link></Button>} />

      <form className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-line bg-white p-3 shadow-card">
        <label className="grid gap-1 text-xs font-medium text-muted-ink">Search
          <input name="q" defaultValue={q} placeholder="Name, phone, property" className="h-9 w-56 rounded-md border border-line px-3 text-sm text-ink outline-none focus:border-redux-blue" />
        </label>
        <Filter name="source" label="Source" value={source} options={(sources ?? []).map((s) => [s.code, SOURCES[s.code]?.label ?? s.name])} />
        <Filter name="status" label="Status" value={status} options={Object.entries(LEAD_STATUS).map(([k, v]) => [k, v.label])} />
        <Filter name="city" label="City" value={city} options={(cities ?? []).map((c) => [c.id, c.name])} />
        {user.role === 'super_admin' && <Filter name="owner" label="Executive" value={owner} options={(owners ?? []).map((o) => [o.id, o.full_name])} />}
        <Button type="submit" variant="secondary" size="sm">Apply</Button>
        {(q || source || status || city || owner) && <Link href="/staff/leads" className="px-2 pb-2 text-sm font-medium text-redux-blue hover:underline">Clear</Link>}
      </form>

      {leads.length === 0 ? (
        <EmptyState icon={SearchX} title="No leads match" body="Try a different filter — or clear them to see every lead." action={<Button variant="outline" asChild><Link href="/staff/leads">Clear filters</Link></Button>} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-white shadow-card">
          <table className="w-full text-sm">
            <thead className="sticky top-16 z-10">
              <tr className="border-b border-line bg-surface text-left">
                {['Lead', 'Source', 'Status', 'City', 'Executive', 'Call-back', 'Received'].map((h) => <th key={h} className="eyebrow px-4 py-3 text-muted-ink">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {leads.map((l, i) => {
                const st = LEAD_STATUS[l.status]
                return (
                  <tr key={l.id} className={`border-b border-line last:border-0 hover:bg-select ${i % 2 ? 'bg-surface/40' : ''}`}>
                    <td className="px-4 py-3">
                      <Link href={`/staff/leads/${l.id}`} className="font-semibold text-ink hover:text-redux-blue">{l.property_name ?? l.name ?? l.phone}</Link>
                      <p className="text-xs text-muted-ink">{l.name}{l.name ? ' · ' : ''}<span className="num">{l.phone}</span></p>
                    </td>
                    <td className="px-4 py-3"><SourceBadge code={l.source?.code ?? ''} /></td>
                    <td className="px-4 py-3">{st && <StatusPill tone={st.tone}>{st.label}</StatusPill>}</td>
                    <td className="px-4 py-3 text-muted-ink">{l.city?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-ink">{l.owner?.full_name ?? <span className="text-warning">Unassigned</span>}</td>
                    <td className="px-4 py-3"><SlaTimer due={l.sla_due_at} done={l.status !== 'new'} />{l.status !== 'new' && <span className="text-xs text-faint">Called</span>}</td>
                    <td className="num px-4 py-3 text-xs text-muted-ink">{formatWhen(l.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-muted-ink">
            <span className="num">Page {page} of {pages}</span>
            <span className="flex gap-2">
              <Button variant="outline" size="sm" asChild disabled={page <= 1}><Link href={link({ page: String(page - 1) })} aria-disabled={page <= 1} className={page <= 1 ? 'pointer-events-none opacity-40' : ''}><ChevronLeft aria-hidden /> Previous</Link></Button>
              <Button variant="outline" size="sm" asChild><Link href={link({ page: String(page + 1) })} aria-disabled={page >= pages} className={page >= pages ? 'pointer-events-none opacity-40' : ''}>Next <ChevronRight aria-hidden /></Link></Button>
            </span>
          </div>
        </div>
      )}
    </>
  )
}

function Filter({ name, label, value, options }: { name: string; label: string; value?: string; options: [string, string][] }) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-ink">{label}
      <select name={name} defaultValue={value ?? ''} className="h-9 rounded-md border border-line bg-white px-2 text-sm text-ink outline-none focus:border-redux-blue">
        <option value="">All</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  )
}
