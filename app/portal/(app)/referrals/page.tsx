import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Gift, Wrench } from 'lucide-react'
import { formatWhen, Money, StatusPill } from '@/components/patterns'
import { requirePortalUser } from '@/lib/data/portal'
import { createClient } from '@/lib/supabase/server'
import { ShareLink } from './share-link'

export const metadata: Metadata = { title: 'Refer & earn' }

type Ref = { id: string; business: string; status: string; created_at: string; converted_at: string | null; credit: number | null }
type Reward = { id: string; kind: string; amount: number | null; description: string; issued_at: string; expires_at: string; status: string; redeemed_at: string | null }
const REF_STATUS: Record<string, { label: string; tone: 'waiting' | 'positive' | 'neutral' }> = {
  pending: { label: 'Not ordered yet', tone: 'waiting' }, converted: { label: 'Ordered', tone: 'positive' },
}

// CR-001 phase 6 (E23, D29) — the referrer's side: their link, who they referred, what they earned
export default async function ReferralsPage() {
  const user = await requirePortalUser('/portal/referrals')
  const account = user.customers.find((c) => !c.is_prospect) ?? user.customers[0]
  const supabase = await createClient()
  const h = await headers()
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`
  const [{ data: code }, { data: refs }, { data: rewards }, { data: prog }] = await Promise.all([
    account ? supabase.rpc('referral_code_for', { p_customer: account.id }) : Promise.resolve({ data: null }),
    supabase.rpc('my_referrals'),
    supabase.rpc('my_rewards'),
    supabase.rpc('referral_programme_terms'),
  ])
  const list = (refs ?? []) as Ref[]
  const ledger = (rewards ?? []) as Reward[]
  const p = (prog ?? { referred_discount_pct: 5, referrer_credit_pct: 5, free_fitting_every: 3 }) as { referred_discount_pct: number; referrer_credit_pct: number; free_fitting_every: number }
  const ordered = list.filter((r) => r.status === 'converted').length
  const available = ledger.filter((r) => r.status === 'available')
  const credit = available.filter((r) => r.kind === 'credit').reduce((s, r) => s + Number(r.amount ?? 0), 0)
  const link = code ? `${origin}/r/${code}` : null
  const toNext = p.free_fitting_every > 0 ? p.free_fitting_every - (ordered % p.free_fitting_every) : null

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow text-redux-blue">Refer &amp; earn</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">Know a hotel or business that should restore, not replace?</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-ink">They get <strong className="text-ink">{p.referred_discount_pct}% off their first order</strong>. You get <strong className="text-ink">{p.referrer_credit_pct}% of that order as credit</strong> once they pay{p.free_fitting_every > 0 ? <>, and <strong className="text-ink">one fitting restored free</strong> for every {p.free_fitting_every} businesses that order</> : null}. Branches of your own group count too.</p>
      </div>

      {link && code && (
        <section className="rounded-xl border-2 border-redux-blue bg-white p-5 shadow-card">
          <p className="text-sm text-muted-ink">Your referral code</p>
          <p className="num mt-1 text-3xl font-bold tracking-wider text-redux-blue">{code}</p>
          <ShareLink link={link} code={code} business={account?.name ?? 'us'} />
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Referred" value={String(list.length)} />
        <Stat label="Ordered" value={String(ordered)} />
        <Stat label="Credit available" value={<Money value={credit.toFixed(0)} paise="never" />} />
        <Stat label="Next free fitting" value={toNext === null ? '—' : `${toNext} more`} />
      </div>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-ink">Businesses you referred</h2>
        {list.length ? (
          <ul className="divide-y divide-line rounded-xl border border-line bg-white shadow-card">
            {list.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span><span className="font-medium text-ink">{r.business}</span><span className="block text-xs text-muted-ink">referred {formatWhen(r.created_at, false)}{r.converted_at ? ` · ordered ${formatWhen(r.converted_at, false)}` : ''}</span></span>
                <span className="flex items-center gap-2">{r.credit ? <span className="num text-xs font-semibold text-success">+<Money value={r.credit} paise="never" /></span> : null}<StatusPill tone={REF_STATUS[r.status]?.tone ?? 'neutral'}>{REF_STATUS[r.status]?.label ?? r.status}</StatusPill></span>
              </li>
            ))}
          </ul>
        ) : <p className="rounded-xl border border-dashed border-line bg-white p-5 text-sm text-muted-ink">No one yet. Share your link — when they register or enquire with it, they appear here.</p>}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-ink">Your rewards</h2>
        {ledger.length ? (
          <ul className="divide-y divide-line rounded-xl border border-line bg-white shadow-card">
            {ledger.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-pale text-redux-blue">{r.kind === 'credit' ? <Gift className="size-4" aria-hidden /> : <Wrench className="size-4" aria-hidden />}</span>
                <span className="flex-1"><span className="font-medium text-ink">{r.kind === 'credit' ? <><Money value={r.amount} paise="never" /> credit</> : 'One fitting restored free'}</span>
                  <span className="block text-xs text-muted-ink">{r.description}</span></span>
                <span className="text-right text-xs text-muted-ink">{r.status === 'redeemed' ? `Used ${formatWhen(r.redeemed_at!, false)}` : r.status === 'expired' ? 'Expired' : `Use by ${formatWhen(r.expires_at, false)}`}</span>
              </li>
            ))}
          </ul>
        ) : <p className="rounded-xl border border-dashed border-line bg-white p-5 text-sm text-muted-ink">Rewards appear here when a business you referred orders and pays. Credit is applied to your next invoice by our team.</p>}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-xl border border-line bg-white p-4 shadow-card"><p className="eyebrow text-muted-ink">{label}</p><p className="num mt-1 text-xl font-semibold text-ink">{value}</p></div>
}
