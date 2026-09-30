import type { Metadata } from 'next'
import Link from 'next/link'
import { IndianRupee, Lock } from 'lucide-react'
import { EmptyState, formatWhen, PageHeader, StatusPill } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { ActivateButton, NewVersionButton, PriceCell } from './rate-card-controls'

export const metadata: Metadata = { title: 'Rate card' }

type Item = { id: string; price: number; gst_rate: number; hsn_sac: string | null; ft: { id: string; name: string; sort_order: number } | null; wt: { code: string; name: string } | null; fin: { name: string } | null }

// B27 — saving creates a new version; an activated version is frozen, so existing quotes keep their
// prices forever (D9-02, BR-A3). The UI says so in plain words.
export default async function RateCardPage({ searchParams }: PageProps<'/staff/admin/rate-card'>) {
  await requireRole(['super_admin'])
  const { v } = await searchParams
  const supabase = await createClient()
  const { data: cards } = await supabase.from('rate_cards').select('id, version, effective_from, is_active, activated_at, notes').order('version', { ascending: false })
  const list = cards ?? []
  const card = list.find((c) => c.id === v) ?? list.find((c) => c.is_active) ?? list[0]
  if (!card) return <><PageHeader title="Rate card" /><EmptyState icon={IndianRupee} title="No rate card yet" body="Load the first price list to start quoting." /></>
  const [{ data: items }, { data: market }, { count: quotes }] = await Promise.all([
    supabase.from('rate_card_items').select('id, price, gst_rate, hsn_sac, ft:fitting_types(id, name, sort_order), wt:work_types(code, name), fin:finishes(name)').eq('rate_card_id', card.id),
    supabase.from('market_prices').select('id, price, ft:fitting_types(id, name), fin:finishes(name)').eq('rate_card_id', card.id),
    supabase.from('quotations').select('id', { count: 'exact', head: true }).eq('rate_card_id', card.id),
  ])
  const rows = (items ?? []) as unknown as Item[]
  const mk = (market ?? []) as unknown as { id: string; price: number; ft: { id: string; name: string } | null; fin: { name: string } | null }[]
  const frozen = !!card.activated_at
  const types = [...new Map(rows.map((r) => [r.ft!.id, r.ft!])).values()].sort((a, b) => a.sort_order - b.sort_order)
  const WORK_ORDER = ['restore_finish', 'repair_function', 'replace_eurobrass']
  const works = [...new Map(rows.map((r) => [r.wt!.code, r.wt!])).values()].sort((a, b) => WORK_ORDER.indexOf(a.code) - WORK_ORDER.indexOf(b.code))
  return (
    <>
      <PageHeader back={{ href: '/staff/admin', label: 'Admin' }} title="Rate card" description="Fitting × work × finish → price, plus what the same fitting costs new at market."
        actions={<NewVersionButton fromId={card.id} />} />
      <nav className="mb-5 flex flex-wrap gap-2" aria-label="Versions">
        {list.map((c) => (
          <Link key={c.id} href={`/staff/admin/rate-card?v=${c.id}`}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium ring-1 ${c.id === card.id ? 'bg-redux-blue text-white ring-redux-blue' : 'bg-white text-ink ring-line hover:bg-surface'}`}>
            v{c.version}{c.is_active && <span className={`rounded-sm px-1.5 text-[10px] font-bold ${c.id === card.id ? 'bg-redux-lime text-redux-blue' : 'bg-success text-white'}`}>ACTIVE</span>}{!c.activated_at && <span className="text-[11px] opacity-80">draft</span>}
          </Link>
        ))}
      </nav>
      <div className={`mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${frozen ? 'border-line bg-white text-muted-ink' : 'border-warning/30 bg-warning-bg text-warning'}`}>
        <p className="flex items-center gap-2">
          {frozen ? <><Lock className="size-4" aria-hidden /> <span><strong className="text-ink">v{card.version} is frozen.</strong> Activated {formatWhen(card.activated_at!)}; {quotes ?? 0} quotation{quotes === 1 ? ' is' : 's are'} priced from it and never change. To change a price, create a new version.</span></>
            : <span><strong>Draft v{card.version}.</strong> Edit prices below, then activate it. New quotes use it from then on; existing quotes keep their prices.</span>}
        </p>
        <div className="flex items-center gap-2">
          {card.is_active ? <StatusPill tone="positive">Active since {formatWhen(card.effective_from, false)}</StatusPill> : !frozen && <ActivateButton id={card.id} version={card.version} />}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-card">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line bg-surface text-left">
            <th className="eyebrow px-4 py-3 text-muted-ink">Fitting</th>
            <th className="eyebrow px-4 py-3 text-muted-ink">Finish</th>
            {works.map((w) => <th key={w.code} className="eyebrow px-4 py-3 text-right text-muted-ink">{w.name}</th>)}
            <th className="eyebrow px-4 py-3 text-right text-muted-ink">Market new</th>
          </tr></thead>
          <tbody>
            {types.flatMap((t) => {
              const finishes = [...new Set(rows.filter((r) => r.ft?.id === t.id).map((r) => r.fin?.name ?? ''))].sort()
              return finishes.map((f, i) => {
                const m = mk.find((x) => x.ft?.id === t.id && (x.fin?.name ?? '') === f) ?? mk.find((x) => x.ft?.id === t.id && !x.fin)
                return (
                  <tr key={`${t.id}-${f}`} className={`border-line ${i === finishes.length - 1 ? 'border-b' : ''}`}>
                    <td className="px-4 py-2 font-medium text-ink">{i === 0 ? t.name : ''}</td>
                    <td className="px-4 py-2 text-muted-ink">{f || 'Any finish'}</td>
                    {works.map((w) => {
                      const it = rows.find((r) => r.ft?.id === t.id && r.wt?.code === w.code && (r.fin?.name ?? '') === f)
                        ?? rows.find((r) => r.ft?.id === t.id && r.wt?.code === w.code && !r.fin)
                      return <td key={w.code} className="px-4 py-2 text-right">{it ? <PriceCell id={it.id} price={Number(it.price)} kind="rate" frozen={frozen} /> : <span className="text-faint">—</span>}</td>
                    })}
                    <td className="px-4 py-2 text-right text-muted-ink">{m ? <PriceCell id={m.id} price={Number(m.price)} kind="market" frozen={frozen} /> : '—'}</td>
                  </tr>
                )
              })
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-ink">GST {rows[0] ? `${Number(rows[0].gst_rate)}%` : '—'} · SAC {rows[0]?.hsn_sac ?? '—'} on every service line.</p>
    </>
  )
}
