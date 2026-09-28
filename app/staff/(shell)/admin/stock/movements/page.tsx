import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, History, Scale, Wrench } from 'lucide-react'
import { EmptyState, formatWhen, PageHeader } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Stock movements' }

const TYPE = {
  in: { label: 'Received', icon: ArrowDownLeft, cls: 'text-success' },
  out: { label: 'Issued out', icon: ArrowUpRight, cls: 'text-danger' },
  consumed: { label: 'Used on job', icon: Wrench, cls: 'text-redux-blue' },
  adjusted: { label: 'Adjusted', icon: Scale, cls: 'text-warning' },
} as const

// B32 — the append-only ledger behind every stock count (BR-ST2).
export default async function MovementsPage() {
  await requireRole(['super_admin'])
  const supabase = await createClient()
  const { data } = await supabase.from('stock_movements')
    .select('id, type, quantity, reason, actor_id, occurred_at, item:stock_items(name, sku, uom), job:jobs(id, job_no)')
    .order('occurred_at', { ascending: false }).limit(200)
  const rows = (data ?? []) as unknown as { id: string; type: keyof typeof TYPE; quantity: number; reason: string | null; actor_id: string; occurred_at: string
    item: { name: string; sku: string; uom: string } | null; job: { id: string; job_no: string } | null }[]
  const ids = [...new Set(rows.map((r) => r.actor_id))]
  const { data: people } = ids.length ? await supabase.from('profiles').select('id, full_name').in('id', ids) : { data: [] }
  return (
    <>
      <Link href="/staff/admin/stock" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-redux-blue hover:underline"><ArrowLeft className="size-4" aria-hidden /> Stock</Link>
      <PageHeader eyebrow="Admin" title="Stock movements" description="Append-only. A wrong entry is corrected by an adjustment, never by editing." />
      {rows.length === 0 ? <EmptyState icon={History} title="No movements yet" body="Every receipt, use and count correction appears here." /> : (
        <div className="overflow-hidden rounded-lg border border-line bg-white shadow-card">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line bg-surface text-left">
              {['When', 'Item', 'Movement', 'Qty', 'Job / reason', 'By'].map((h, i) => <th key={h} className={`eyebrow px-4 py-3 text-muted-ink ${i === 3 ? 'text-right' : ''}`}>{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.map((r) => {
                const t = TYPE[r.type]
                const sign = r.type === 'in' ? '+' : r.type === 'adjusted' ? (Number(r.quantity) > 0 ? '+' : '') : '−'
                return (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 text-xs whitespace-nowrap text-muted-ink">{formatWhen(r.occurred_at)}</td>
                    <td className="px-4 py-3"><p className="font-medium text-ink">{r.item?.name}</p><p className="num text-xs text-faint">{r.item?.sku}</p></td>
                    <td className={`px-4 py-3 ${t.cls}`}><span className="inline-flex items-center gap-1.5 font-medium"><t.icon className="size-4" aria-hidden /> {t.label}</span></td>
                    <td className="num px-4 py-3 text-right font-semibold">{sign}{Math.abs(Number(r.quantity)).toLocaleString('en-IN')} <span className="text-xs font-normal text-muted-ink">{r.item?.uom}</span></td>
                    <td className="px-4 py-3 text-xs text-muted-ink">{r.job && <Link href={`/staff/jobs/${r.job.id}`} className="num font-medium text-redux-blue hover:underline">{r.job.job_no}</Link>}{r.job && r.reason ? ' · ' : ''}{r.reason}</td>
                    <td className="px-4 py-3 text-xs text-muted-ink">{people?.find((p) => p.id === r.actor_id)?.full_name ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
