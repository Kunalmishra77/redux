import type { Metadata } from 'next'
import Link from 'next/link'
import { Megaphone, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState, formatWhen, PageHeader, Panel, StatusPill } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { CadenceToggle, NewOffer, OfferToggle } from './campaign-controls'

export const metadata: Metadata = { title: 'Campaigns' }

const STATUS = { draft: { label: 'Draft', tone: 'neutral' }, scheduled: { label: 'Scheduled', tone: 'progress' }, sent: { label: 'Sent', tone: 'done' }, cancelled: { label: 'Cancelled', tone: 'neutral' } } as const

type Camp = { id: string; name: string; channel: string; status: keyof typeof STATUS; scheduled_at: string | null; launched_at: string | null; created_at: string
  offer: { code: string } | null; recipients: { status: string }[] }

// E26 (D32) — outreach campaigns, the offers they carry, and the executives' follow-up cadences.
export default async function CampaignsPage() {
  const user = await requireRole(['super_admin', 'cc_exec'])
  const isAdmin = user.role === 'super_admin'
  const supabase = await createClient()
  const [{ data: camps }, { data: offers }, { data: cadences }, { data: used }] = await Promise.all([
    supabase.from('outreach_campaigns').select('id, name, channel, status, scheduled_at, launched_at, created_at, offer:offers(code), recipients:outreach_recipients(status)').order('created_at', { ascending: false }),
    supabase.from('offers').select('id, code, title, discount_pct, valid_until, eligible_tiers, max_redemptions, is_active').order('created_at', { ascending: false }),
    supabase.from('followup_cadences').select('id, name, tier, on_status, steps, is_active').order('sort_order'),
    supabase.from('quotations').select('offer_id').eq('status', 'approved').not('offer_id', 'is', null),
  ])
  const list = (camps ?? []) as unknown as Camp[]
  const usedBy = new Map<string, number>()
  for (const q of used ?? []) usedBy.set(q.offer_id!, (usedBy.get(q.offer_id!) ?? 0) + 1)
  const count = (c: Camp, ...s: string[]) => c.recipients.filter((r) => s.includes(r.status)).length

  return (
    <>
      <PageHeader title="Campaigns" description="WhatsApp and email outreach to people who said yes to marketing — never to anyone else. Quiet hours and a weekly limit per person apply to every message."
        actions={isAdmin ? <Button asChild><Link href="/staff/campaigns/new"><Plus aria-hidden /> New campaign</Link></Button> : null} />

      {list.length === 0 ? (
        <EmptyState icon={Megaphone} title="No campaigns yet" body="Bring back lost leads, invite customers to refer, or announce a seasonal offer. You see exactly who will receive it before anything goes out." />
      ) : (
        <div className="relative mb-8 overflow-x-auto rounded-lg border border-line bg-white shadow-card">
          <table className="w-full min-w-[48rem] text-sm">
            <thead><tr className="border-b border-line bg-surface text-left">{['Campaign', 'Channel', 'Sent', 'Skipped', 'Replied', 'Reactivated', 'Status'].map((h, i) => <th key={h} className={`eyebrow px-4 py-3 text-muted-ink ${i >= 2 && i <= 5 ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0 hover:bg-select">
                  <td className="px-4 py-3"><Link href={`/staff/campaigns/${c.id}`} className="font-semibold text-ink hover:text-redux-blue">{c.name}</Link>
                    <p className="text-xs text-muted-ink">{c.offer ? `offer ${c.offer.code} · ` : ''}{c.launched_at ? `sent ${formatWhen(c.launched_at)}` : c.scheduled_at ? `goes out ${formatWhen(c.scheduled_at)}` : `created ${formatWhen(c.created_at, false)}`}</p></td>
                  <td className="px-4 py-3 capitalize text-muted-ink">{c.channel}</td>
                  <td className="num px-4 py-3 text-right">{count(c, 'queued', 'replied', 'reactivated', 'opted_out')}</td>
                  <td className="num px-4 py-3 text-right text-muted-ink">{count(c, 'skipped')}</td>
                  <td className="num px-4 py-3 text-right">{count(c, 'replied', 'reactivated')}</td>
                  <td className="num px-4 py-3 text-right font-semibold text-success">{count(c, 'reactivated')}</td>
                  <td className="px-4 py-3"><StatusPill tone={STATUS[c.status].tone}>{STATUS[c.status].label}</StatusPill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Offers" action={isAdmin ? <NewOffer /> : null}>
          {offers?.length ? (
            <ul className="divide-y divide-line text-sm">
              {offers.map((o) => (
                <li key={o.id} className={`flex flex-wrap items-center justify-between gap-3 py-2.5 ${o.is_active ? '' : 'opacity-60'}`}>
                  <span><span className="num font-semibold text-ink">{o.code}</span> · {o.title}
                    <span className="block text-xs text-muted-ink"><span className="num">{Number(o.discount_pct)}%</span> off · tiers {o.eligible_tiers.join('/')} · until {formatWhen(o.valid_until, false)} · used <span className="num">{usedBy.get(o.id) ?? 0}</span>{o.max_redemptions ? ` of ${o.max_redemptions}` : ''}</span></span>
                  {isAdmin && <OfferToggle id={o.id} active={o.is_active} />}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-ink">No offers yet. An offer is a code the team applies on a quotation; it never adds to a referral discount — the larger one wins.</p>}
        </Panel>

        <Panel title="Follow-up cadences">
          <p className="mb-3 text-sm text-muted-ink">Tasks the system gives the lead’s executive when a lead reaches a stage. Moving on closes the open ones.</p>
          <ul className="space-y-3 text-sm">
            {(cadences ?? []).map((c) => (
              <li key={c.id} className={`rounded-md border border-line p-3 ${c.is_active ? '' : 'opacity-60'}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-ink">{c.name} <span className="text-xs font-normal text-muted-ink">· {c.tier ? `tier ${c.tier}` : 'any tier'} · when {c.on_status.replace('_', ' ')}</span></p>
                  {isAdmin && <CadenceToggle id={c.id} active={c.is_active} />}
                </div>
                <ol className="mt-1.5 space-y-0.5 text-xs text-muted-ink">
                  {(c.steps as { day: number; note: string }[]).map((s, i) => <li key={i}><span className="num font-semibold text-ink">Day {s.day}</span> — {s.note}</li>)}
                </ol>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  )
}
