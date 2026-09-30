import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, Boxes, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState, formatRelative, Kpi, PageHeader } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { MovementButton } from './movement-dialog'

export const metadata: Metadata = { title: 'Stock' }

const CATEGORY: Record<string, string> = { cartridge: 'Cartridges', spare: 'Spares', finish: 'Finishing', replacement: 'Eurobrass replacements' }

// B31 — quantity is the ledger's, never a form field (BR-ST1/ST2). Low stock alerts once per crossing (BR-ST3).
export default async function StockPage() {
  await requireRole(['super_admin'])
  const supabase = await createClient()
  const [{ data: items }, { data: jobs }] = await Promise.all([
    supabase.from('stock_items').select('id, sku, name, category, uom, quantity, min_level, below_min_since').eq('is_active', true).order('category').order('name'),
    supabase.from('jobs').select('id, job_no').neq('status', 'completed').order('created_at', { ascending: false }),
  ])
  const list = items ?? []
  const low = list.filter((i) => Number(i.quantity) < Number(i.min_level))
  const groups = [...new Set(list.map((i) => i.category ?? 'other'))]
  const options = list.map((i) => ({ id: i.id, label: `${i.name} (${i.sku})`, uom: i.uom, quantity: Number(i.quantity) }))
  return (
    <>
      <PageHeader back={{ href: '/staff/admin', label: 'Admin' }} title="Stock & parts" description="Every change is a movement with a person and a reason. Quantity can never go below zero."
        actions={<><Button variant="outline" asChild><Link href="/staff/admin/stock/movements"><History aria-hidden /> Movements</Link></Button><MovementButton items={options} jobs={jobs ?? []} /></>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Kpi label="Items tracked" value={list.length} />
        <Kpi label="Below minimum" value={<span className={low.length ? 'text-danger' : ''}>{low.length}</span>} hint={low.length ? 'Reorder now' : 'All above minimum'} />
        <Kpi label="Units in stock" value={list.reduce((s, i) => s + Number(i.quantity), 0).toLocaleString('en-IN')} />
      </div>
      {list.length === 0 ? <EmptyState icon={Boxes} title="No stock items yet" body="Add parts and cartridges in Admin → Masters." /> : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g} className="overflow-hidden rounded-lg border border-line bg-white shadow-card">
              <h2 className="border-b border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink">{CATEGORY[g] ?? 'Other'}</h2>
              <table className="w-full text-sm">
                <tbody>
                  {list.filter((i) => (i.category ?? 'other') === g).map((i) => {
                    const q = Number(i.quantity), min = Number(i.min_level)
                    const isLow = q < min
                    const pct = min > 0 ? Math.min(100, (q / (min * 2)) * 100) : 100
                    return (
                      <tr key={i.id} className={`border-b border-line last:border-0 ${isLow ? 'bg-danger-bg/50' : ''}`}>
                        <td className="px-4 py-3"><p className="font-medium text-ink">{i.name}</p><p className="num text-xs text-faint">{i.sku}</p></td>
                        <td className="w-48 px-4 py-3">
                          <div className="h-1.5 rounded-full bg-line"><div className={`h-1.5 rounded-full ${isLow ? 'bg-danger' : 'bg-redux-blue'}`} style={{ width: `${pct}%` }} /></div>
                          <p className="mt-1 text-[11px] text-muted-ink">min {min.toLocaleString('en-IN')}</p>
                        </td>
                        <td className="num px-4 py-3 text-right text-base font-semibold whitespace-nowrap">{q.toLocaleString('en-IN')} <span className="text-xs font-normal text-muted-ink">{i.uom}</span></td>
                        <td className="w-44 px-4 py-3 text-right text-xs">
                          {isLow && <span className="inline-flex items-center gap-1 font-semibold text-danger"><AlertTriangle className="size-3.5" aria-hidden /> Low{i.below_min_since ? ` · ${formatRelative(i.below_min_since)}` : ''}</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
