import type { Metadata } from 'next'
import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { formatWhen } from '@/components/patterns'
import { createClient } from '@/lib/supabase/server'
import { requirePortalUser } from '@/lib/data/portal'
import { nowMs } from '@/lib/services/clock'

export const metadata: Metadata = { title: 'Warranty cards' }

type W = { id: string; card_no: string; kind: string; valid_from: string; valid_until: string; terms_text: string
  unit: { pu: { label: string } | null } | null; fitting: { ft: { name: string } | null; finish: { name: string } | null } | null }

// D7s — one card per warranty; expiring within 30 days gets a warning tint.
export default async function WarrantyPage() {
  await requirePortalUser()
  const supabase = await createClient()
  const { data } = await supabase.from('warranties')
    .select('id, card_no, kind, valid_from, valid_until, terms_text, unit:job_units(pu:property_units(label)), fitting:fittings(ft:fitting_types(name), finish:finishes(name))')
    .order('valid_until')
  const cards = (data ?? []) as unknown as W[]
  const today = new Date(nowMs()).toISOString().slice(0, 10)
  const soon = new Date(nowMs() + 30 * 86_400_000).toISOString().slice(0, 10)
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Warranty cards</h1>
        <p className="mt-1 text-sm text-muted-ink">Each restored fitting carries its own warranty from the day it went back into service.</p>
      </div>
      {cards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted-ink"><ShieldCheck className="mx-auto mb-2 size-6 text-redux-blue" aria-hidden />Warranty cards are issued at handover.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((w) => {
            const expired = w.valid_until < today
            const expiring = !expired && w.valid_until <= soon
            return (
              <article key={w.id} className={`overflow-hidden rounded-xl border shadow-card ${expired ? 'border-line bg-surface opacity-70' : expiring ? 'border-warning/40 bg-warning-bg' : 'border-line bg-white'}`}>
                <div className="flex items-center justify-between bg-redux-blue px-4 py-3">
                  <Logo tone="white" />
                  <span className="rounded-sm bg-redux-lime px-2 py-0.5 text-[11px] font-bold text-redux-blue uppercase">{w.kind === 'finish' ? 'Finish' : 'Mechanical'}</span>
                </div>
                <div className="p-4">
                  <p className="font-semibold text-ink">{[w.fitting?.ft?.name, w.fitting?.finish?.name].filter(Boolean).join(' · ')}</p>
                  <p className="text-sm text-muted-ink">{w.unit?.pu ? `Room / bathroom ${w.unit.pu.label}` : ''}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div><dt className="eyebrow text-faint">Valid from</dt><dd>{formatWhen(w.valid_from, false)}</dd></div>
                    <div><dt className="eyebrow text-faint">Valid until</dt><dd className={expiring ? 'font-semibold text-warning' : expired ? 'text-danger' : ''}>{formatWhen(w.valid_until, false)}{expired ? ' · expired' : ''}</dd></div>
                  </dl>
                  <p className="num mt-3 text-xs text-muted-ink">Card {w.card_no}</p>
                  <details className="mt-2 text-xs text-muted-ink"><summary className="cursor-pointer font-medium text-redux-blue">Terms</summary><p className="mt-1 whitespace-pre-line">{w.terms_text}</p></details>
                  {!expired && <Link href={`/portal/service-requests/new?warranty=${w.id}`} className="mt-3 inline-block text-sm font-semibold text-redux-blue hover:underline">Claim under this warranty →</Link>}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
