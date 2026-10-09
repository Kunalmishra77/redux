import type { Metadata } from 'next'
import Link from 'next/link'
import { Share2 } from 'lucide-react'
import { EmptyState, formatWhen, Money, PageHeader, Panel, StatusPill } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { LinkReferral, ProgrammeSettings, RedeemReward, RejectReferral } from './referral-controls'

export const metadata: Metadata = { title: 'Referrals' }

const STATUS = {
  pending: { label: 'Waiting for first order', tone: 'waiting' }, converted: { label: 'Ordered — credit on payment', tone: 'progress' },
  rewarded: { label: 'Rewarded', tone: 'positive' }, rejected: { label: 'Rejected', tone: 'neutral' },
} as const
const CHANNEL: Record<string, string> = { code: 'Code', link: 'Link', registration: 'Registration', manual: 'Added by the team' }

type Ref = { id: string; status: keyof typeof STATUS; channel: string; created_at: string; first_order_value: number | null; rejected_reason: string | null
  referrer: { id: string; name: string } | null; referred: { id: string; name: string } | null; lead: { id: string; name: string | null; property_name: string | null } | null }
type Reward = { id: string; customer_id: string; kind: string; amount: number | null; description: string; issued_at: string; expires_at: string; status: string; redeemed_at: string | null }

// E23 (D29) — the referral programme: what came in, what needs linking, and the reward ledger (BR-R1…R6)
export default async function ReferralsPage() {
  const user = await requireRole(['super_admin', 'cc_exec'])
  const isAdmin = user.role === 'super_admin'
  const supabase = await createClient()
  const [{ data: refs }, { data: rewards }, { data: loose }, { data: accounts }, { data: prog }] = await Promise.all([
    supabase.from('referrals').select('id, status, channel, created_at, first_order_value, rejected_reason, referrer:customers!referrals_referrer_customer_id_fkey(id, name), referred:customers!referrals_referred_customer_id_fkey(id, name), lead:leads!referrals_referred_lead_id_fkey(id, name, property_name)').order('created_at', { ascending: false }),
    supabase.from('v_rewards').select('id, customer_id, kind, amount, description, issued_at, expires_at, status, redeemed_at').order('issued_at', { ascending: false }),
    supabase.from('leads').select('id, name, property_name, customer_id, created_at, raw_payload').not('raw_payload->>referred_by', 'is', null).not('status', 'in', '(lost)').order('created_at', { ascending: false }).limit(50),
    supabase.from('customers').select('id, name').eq('kind', 'business').order('name'),
    supabase.from('settings').select('value').eq('key', 'referral_programme').maybeSingle(),
  ])
  const list = (refs ?? []) as unknown as Ref[]
  const linkedLeads = new Set(list.filter((r) => r.status !== 'rejected').map((r) => r.lead?.id).filter(Boolean))
  const linkedAccounts = new Set(list.filter((r) => r.status !== 'rejected').map((r) => r.referred?.id).filter(Boolean))
  const toLink = (loose ?? []).filter((l) => !linkedLeads.has(l.id) && !(l.customer_id && linkedAccounts.has(l.customer_id)))
  const ledger = (rewards ?? []) as Reward[]
  const nameOf = new Map((accounts ?? []).map((a) => [a.id, a.name]))
  // what each reward could be redeemed against (only loaded for available ones)
  const holders = [...new Set(ledger.filter((r) => r.status === 'available').map((r) => r.customer_id))]
  const [{ data: invs }, { data: quotes }] = holders.length && isAdmin ? await Promise.all([
    supabase.from('invoices').select('id, invoice_no, customer_id, total, amount_paid').in('customer_id', holders).in('status', ['issued', 'part_paid']),
    supabase.from('quotations').select('id, quote_no, version, customer_id, status').in('customer_id', holders).in('status', ['draft', 'sent', 'approved']),
  ]) : [{ data: [] }, { data: [] }]
  const p = (prog?.value ?? {}) as { referred_discount_pct: number; referrer_credit_pct: number; free_fitting_every: number; reward_validity_days: number }
  const converted = list.filter((r) => r.status === 'converted' || r.status === 'rewarded')
  const revenue = converted.reduce((s, r) => s + Number(r.first_order_value ?? 0), 0)

  return (
    <>
      <PageHeader title="Referrals" description={`Referred businesses get ${p.referred_discount_pct ?? 5}% off their first order; the referrer earns ${p.referrer_credit_pct ?? 5}% credit when it is paid, and a free fitting for every ${p.free_fitting_every ?? 3} that order.`} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Fact label="Referrals" value={String(list.filter((r) => r.status !== 'rejected').length)} />
        <Fact label="Ordered" value={String(converted.length)} />
        <Fact label="First-order value" value={<Money value={revenue.toFixed(0)} paise="never" />} />
        <Fact label="Rewards available" value={String(ledger.filter((r) => r.status === 'available').length)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          {toLink.length > 0 && (
            <Panel title={`Needs linking (${toLink.length})`}>
              <p className="mb-3 text-sm text-muted-ink">These enquiries named someone in “referred by” that is not a referral code. Link the referring account, or leave it.</p>
              <ul className="divide-y divide-line text-sm">
                {toLink.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <span><Link href={`/staff/leads/${l.id}`} className="font-medium text-ink hover:underline">{l.property_name ?? l.name}</Link>
                      <span className="block text-xs text-muted-ink">said “{(l.raw_payload as { referred_by?: string }).referred_by}” · {formatWhen(l.created_at, false)}</span></span>
                    <LinkReferral leadId={l.id} customerId={l.customer_id} accounts={(accounts ?? []).filter((a) => a.id !== l.customer_id)} hint={(l.raw_payload as { referred_by?: string }).referred_by ?? ''} />
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Referrals">
            {list.length ? (
              <table className="w-full min-w-[44rem] text-sm">
                <thead><tr className="border-b border-line text-left text-xs text-muted-ink">{['Referred', 'By', 'How', 'First order', 'Status', ''].map((h) => <th key={h} className="px-2 py-2 font-semibold">{h}</th>)}</tr></thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.id} className="border-b border-line align-top last:border-0">
                      <td className="px-2 py-2.5">{r.referred ? <Link className="font-medium text-ink hover:underline" href={`/staff/accounts/${r.referred.id}`}>{r.referred.name}</Link> : r.lead ? <Link className="font-medium text-ink hover:underline" href={`/staff/leads/${r.lead.id}`}>{r.lead.property_name ?? r.lead.name}</Link> : '—'}
                        <span className="block text-xs text-muted-ink">{formatWhen(r.created_at, false)}</span></td>
                      <td className="px-2 py-2.5">{r.referrer && <Link className="text-redux-blue hover:underline" href={`/staff/accounts/${r.referrer.id}`}>{r.referrer.name}</Link>}</td>
                      <td className="px-2 py-2.5 text-muted-ink">{CHANNEL[r.channel]}</td>
                      <td className="num px-2 py-2.5">{r.first_order_value ? <Money value={r.first_order_value} paise="never" /> : '—'}</td>
                      <td className="px-2 py-2.5"><StatusPill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</StatusPill>{r.rejected_reason && <span className="block text-xs text-muted-ink">{r.rejected_reason}</span>}</td>
                      <td className="px-2 py-2.5">{isAdmin && r.status === 'pending' && <RejectReferral referralId={r.id} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <EmptyState icon={Share2} title="No referrals yet" body="Every account has a referral link in its portal. Referrals also come in through “referred by” on registration and enquiries, or are added here by the team." />}
          </Panel>

          <Panel title="Rewards ledger">
            {ledger.length ? (
              <ul className="divide-y divide-line text-sm">
                {ledger.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <span><span className="font-medium text-ink">{r.kind === 'credit' ? <><Money value={r.amount} paise="never" /> credit</> : 'Free fitting'}</span> · {nameOf.get(r.customer_id) ?? 'Account'}
                      <span className="block text-xs text-muted-ink">{r.description} · issued {formatWhen(r.issued_at, false)} · {r.status === 'redeemed' ? `used ${formatWhen(r.redeemed_at!, false)}` : r.status === 'expired' ? 'expired' : `valid until ${formatWhen(r.expires_at, false)}`}</span></span>
                    {r.status === 'available' && isAdmin
                      ? <RedeemReward rewardId={r.id} kind={r.kind}
                          invoices={(invs ?? []).filter((i) => i.customer_id === r.customer_id).map((i) => ({ id: i.id, label: `${i.invoice_no} · due ₹${Math.round(Number(i.total) - Number(i.amount_paid)).toLocaleString('en-IN')}` }))}
                          quotations={(quotes ?? []).filter((q) => q.customer_id === r.customer_id).map((q) => ({ id: q.id, label: `${q.quote_no} v${q.version} · ${q.status}` }))} />
                      : <StatusPill tone={r.status === 'available' ? 'positive' : 'neutral'}>{r.status}</StatusPill>}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-ink">Rewards appear when a referred business orders (free fitting every few) and pays (credit).</p>}
          </Panel>
        </div>
        <div className="min-w-0 space-y-5">
          <Panel title="Programme">{isAdmin ? <ProgrammeSettings value={p} /> : (
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-muted-ink">Referred business</dt><dd>{p.referred_discount_pct}% off first order</dd></div>
              <div className="flex justify-between"><dt className="text-muted-ink">Referrer credit</dt><dd>{p.referrer_credit_pct}% when paid</dd></div>
              <div className="flex justify-between"><dt className="text-muted-ink">Free fitting</dt><dd>every {p.free_fitting_every} orders</dd></div>
            </dl>)}
          </Panel>
        </div>
      </div>
    </>
  )
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-lg border border-line bg-white p-3.5 shadow-card"><p className="eyebrow text-muted-ink">{label}</p><p className="num mt-1 text-lg font-semibold text-ink">{value}</p></div>
}
