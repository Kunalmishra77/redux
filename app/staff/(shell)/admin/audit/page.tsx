import type { Metadata } from 'next'
import Link from 'next/link'
import { FileClock } from 'lucide-react'
import { EmptyState, formatWhen, PageHeader } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Audit log' }

const PAGE = 50
const ENTITIES = ['quotations', 'invoices', 'payments', 'jobs', 'settings', 'rate_cards', 'stock_items', 'user_roles', 'profiles', 'service_requests']

// B37 — BR-X4: every privileged change with who, when, before and after. Read-only, append-only.
export default async function AuditPage({ searchParams }: PageProps<'/staff/admin/audit'>) {
  await requireRole(['super_admin'])
  const sp = await searchParams
  const entity = typeof sp.entity === 'string' && ENTITIES.includes(sp.entity) ? sp.entity : null
  const page = Math.max(1, Number(sp.page) || 1)
  const supabase = await createClient()
  let q = supabase.from('audit_log').select('id, actor_id, actor_role, action, entity_type, entity_id, before, after, occurred_at', { count: 'exact' })
    .order('occurred_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1)
  if (entity) q = q.eq('entity_type', entity)
  const { data, count } = await q
  const rows = data ?? []
  const ids = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[]
  const { data: people } = ids.length ? await supabase.from('profiles').select('id, full_name').in('id', ids) : { data: [] }
  const who = (id: string | null, role: string | null) => people?.find((p) => p.id === id)?.full_name ?? (role === 'customer' ? 'Customer' : id ? 'User' : 'System')
  const changed = (b: unknown, a: unknown) => {
    const before = (b ?? {}) as Record<string, unknown>, after = (a ?? {}) as Record<string, unknown>
    return Object.keys(after).filter((k) => !['updated_at', 'created_at'].includes(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k])).slice(0, 4)
      .map((k) => ({ k, from: before[k], to: after[k] }))
  }
  const show = (v: unknown) => (v === null || v === undefined ? '∅' : typeof v === 'object' ? JSON.stringify(v).slice(0, 40) : String(v).slice(0, 40))
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE))
  const href = (p: number, e = entity) => `/staff/admin/audit?${new URLSearchParams({ ...(e ? { entity: e } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`
  return (
    <>
      <PageHeader eyebrow="Admin" title="Audit log" description="Every privileged change: who made it, when, and what it was before. Nobody can edit this list." />
      <nav className="mb-4 flex flex-wrap gap-1.5" aria-label="Filter by record type">
        <Link href={href(1, null)} className={`rounded-full px-3 py-1.5 text-sm font-medium ${!entity ? 'bg-redux-blue text-white' : 'bg-white text-muted-ink ring-1 ring-line'}`}>All</Link>
        {ENTITIES.map((e) => <Link key={e} href={href(1, e)} className={`rounded-full px-3 py-1.5 text-sm font-medium ${entity === e ? 'bg-redux-blue text-white' : 'bg-white text-muted-ink ring-1 ring-line hover:text-ink'}`}>{e.replace(/_/g, ' ')}</Link>)}
      </nav>
      {rows.length === 0 ? <EmptyState icon={FileClock} title="Nothing recorded yet" body="Changes to quotes, invoices, jobs, settings and roles appear here." /> : (
        <div className="overflow-hidden rounded-lg border border-line bg-white shadow-card">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line bg-surface text-left">
              {['When', 'Who', 'What', 'Change'].map((h) => <th key={h} className="eyebrow px-4 py-3 text-muted-ink">{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line align-top last:border-0">
                  <td className="px-4 py-3 text-xs whitespace-nowrap text-muted-ink">{formatWhen(r.occurred_at)}</td>
                  <td className="px-4 py-3"><p className="text-ink">{who(r.actor_id, r.actor_role)}</p><p className="text-xs text-faint">{r.actor_role ?? 'system'}</p></td>
                  <td className="px-4 py-3"><p className="font-medium text-ink">{r.action.toLowerCase()} · {r.entity_type.replace(/_/g, ' ')}</p><p className="num text-xs text-faint">{String(r.entity_id ?? '').slice(0, 8)}</p></td>
                  <td className="px-4 py-3 text-xs">
                    {r.action === 'UPDATE' ? changed(r.before, r.after).map((c) => (
                      <p key={c.k}><span className="text-muted-ink">{c.k}:</span> <span className="text-danger line-through">{show(c.from)}</span> → <span className="text-success">{show(c.to)}</span></p>
                    )) : <span className="text-muted-ink">{r.action === 'INSERT' ? 'Created' : 'Removed'}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-ink">Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={href(page - 1)} className="rounded-md bg-white px-3 py-1.5 ring-1 ring-line">Newer</Link>}
            {page < pages && <Link href={href(page + 1)} className="rounded-md bg-white px-3 py-1.5 ring-1 ring-line">Older</Link>}
          </div>
        </div>
      )}
    </>
  )
}
