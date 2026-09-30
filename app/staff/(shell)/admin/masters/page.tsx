import type { Metadata } from 'next'
import { PageHeader, Panel } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { AddMaster, MasterToggle } from './master-controls'

export const metadata: Metadata = { title: 'Master lists' }

type Master = { id: string; name: string; is_active: boolean; hex?: string | null }

// B28 — the lists every form draws from. Nothing is hardcoded; retiring an entry hides it from new
// work but keeps history intact (never a delete).
export default async function MastersPage() {
  await requireRole(['super_admin'])
  const supabase = await createClient()
  const [ft, br, fi, wt, cf, lr, co] = await Promise.all([
    supabase.from('fitting_types').select('id, name, is_active').order('sort_order'),
    supabase.from('brands').select('id, name, is_active').order('name'),
    supabase.from('finishes').select('id, name, is_active, hex').order('name'),
    supabase.from('work_types').select('id, name, is_active').order('name'),
    supabase.from('condition_flags').select('id, name, is_active').order('sort_order'),
    supabase.from('lost_reasons').select('id, name, is_active').order('sort_order'),
    supabase.from('call_outcomes').select('id, name, is_active').order('sort_order'),
  ])
  const lists: { table: Parameters<typeof MasterToggle>[0]['table']; title: string; rows: Master[]; addable: boolean }[] = [
    { table: 'fitting_types', title: 'Fitting types', rows: ft.data ?? [], addable: true },
    { table: 'brands', title: 'Brands', rows: br.data ?? [], addable: true },
    { table: 'finishes', title: 'Finishes', rows: fi.data ?? [], addable: true },
    { table: 'work_types', title: 'Work types', rows: wt.data ?? [], addable: false },
    { table: 'condition_flags', title: 'Condition flags', rows: cf.data ?? [], addable: true },
    { table: 'lost_reasons', title: 'Lost reasons', rows: lr.data ?? [], addable: true },
    { table: 'call_outcomes', title: 'Call outcomes', rows: co.data ?? [], addable: false },
  ]
  return (
    <>
      <PageHeader back={{ href: '/staff/admin', label: 'Admin' }} title="Master lists" description="What the surveyor app and every form choose from. Retire an entry to hide it — history keeps it." />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {lists.map((l) => (
          <Panel key={l.table} title={l.title} action={<span className="num text-xs text-muted-ink">{l.rows.filter((r) => r.is_active).length} active</span>}>
            <ul className="divide-y divide-line">
              {l.rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className={`flex items-center gap-2 ${r.is_active ? 'text-ink' : 'text-faint line-through'}`}>
                    {r.hex && <span className="size-3.5 rounded-full ring-1 ring-line" style={{ background: r.hex }} aria-hidden />}{r.name}
                  </span>
                  <MasterToggle table={l.table} id={r.id} active={r.is_active} label={r.name} />
                </li>
              ))}
            </ul>
            {l.addable && <AddMaster table={l.table as Parameters<typeof AddMaster>[0]['table']} />}
          </Panel>
        ))}
      </div>
    </>
  )
}
