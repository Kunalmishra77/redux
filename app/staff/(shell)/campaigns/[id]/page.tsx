import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatWhen, PageHeader, Panel, StatusPill } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { nowMs } from '@/lib/services/clock'
import { CampaignActions, SimulateReply } from '../campaign-controls'

export const metadata: Metadata = { title: 'Campaign' }

const R_STATUS: Record<string, { label: string; tone: 'neutral' | 'progress' | 'positive' | 'waiting' | 'done' }> = {
  queued: { label: 'Sent', tone: 'progress' }, skipped: { label: 'Skipped', tone: 'neutral' }, replied: { label: 'Replied', tone: 'done' },
  reactivated: { label: 'Reactivated', tone: 'positive' }, opted_out: { label: 'Opted out', tone: 'waiting' },
}
const SKIP: Record<string, string> = { no_marketing_consent: 'no marketing consent', frequency_cap: 'weekly limit reached', no_email: 'no email', no_phone: 'no number' }

type Rec = { id: string; name: string | null; address: string; status: string; skip_reason: string | null; replied_at: string | null
  lead_id: string | null; customer_id: string | null; reactivated_lead_id: string | null; msg: { status: string; send_after: string } | null }

// E26 (D32) — one campaign: who got it, who was skipped and why, who replied, who came back (BR-C1…C3, BR-L8)
export default async function CampaignPage({ params }: PageProps<'/staff/campaigns/[id]'>) {
  const user = await requireRole(['super_admin', 'cc_exec'])
  const { id } = await params
  const supabase = await createClient()
  const { data: c } = await supabase.from('outreach_campaigns')
    .select('id, name, channel, template_code, status, audience, scheduled_at, launched_at, offer:offers(code, title, discount_pct)').eq('id', id).maybeSingle()
  if (!c) notFound()
  const { data: recs } = await supabase.from('outreach_recipients')
    .select('id, name, address, status, skip_reason, replied_at, lead_id, customer_id, reactivated_lead_id, msg:messages(status, send_after)')
    .eq('campaign_id', id).order('status').order('name')
  const list = (recs ?? []) as unknown as Rec[]
  const offer = c.offer as unknown as { code: string; title: string; discount_pct: number } | null
  const n = (s: string) => list.filter((r) => r.status === s).length
  const demo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && user.role === 'super_admin' && c.channel === 'whatsapp'

  return (
    <>
      <PageHeader back={{ href: '/staff/campaigns', label: 'Campaigns' }} title={c.name}
        description={`${c.channel === 'whatsapp' ? 'WhatsApp' : 'Email'} · ${c.template_code.replace(/_/g, ' ')}${offer ? ` · offer ${offer.code} (${Number(offer.discount_pct)}%)` : ''}${c.launched_at ? ` · sent ${formatWhen(c.launched_at)}` : c.scheduled_at ? ` · goes out ${formatWhen(c.scheduled_at)}` : ''}`}
        actions={user.role === 'super_admin' ? <CampaignActions id={id} status={c.status} /> : null} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {([['Sent', n('queued') + n('replied') + n('reactivated') + n('opted_out')], ['Skipped', n('skipped')], ['Replied', n('replied') + n('reactivated')], ['Lost leads back', n('reactivated')], ['Opted out', n('opted_out')]] as const).map(([l, v]) => (
          <div key={l} className="rounded-lg border border-line bg-white p-3.5 shadow-card"><p className="eyebrow text-muted-ink">{l}</p><p className="num mt-1 text-xl font-semibold text-ink">{v}</p></div>
        ))}
      </div>
      <Panel title={`Recipients (${list.length})`}>
        {list.length ? (
          <table className="w-full min-w-[40rem] text-sm">
            <thead><tr className="border-b border-line text-left text-xs text-muted-ink">{['Who', 'To', 'Status', '', ''].map((h, i) => <th key={i} className="px-2 py-2 font-semibold">{h}</th>)}</tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-2 py-2.5">{r.lead_id ? <Link href={`/staff/leads/${r.lead_id}`} className="text-ink hover:underline">{r.name ?? '—'}</Link> : r.customer_id ? <Link href={`/staff/accounts/${r.customer_id}`} className="text-ink hover:underline">{r.name ?? '—'}</Link> : r.name}</td>
                  <td className="num px-2 py-2.5 text-muted-ink">{r.address.startsWith('none:') ? '—' : r.address}</td>
                  <td className="px-2 py-2.5"><StatusPill tone={R_STATUS[r.status]?.tone ?? 'neutral'}>{R_STATUS[r.status]?.label ?? r.status}</StatusPill></td>
                  <td className="px-2 py-2.5 text-xs text-muted-ink">{r.skip_reason ? SKIP[r.skip_reason] ?? r.skip_reason : r.status === 'queued' && r.msg && new Date(r.msg.send_after).getTime() > nowMs() ? `goes out ${formatWhen(r.msg.send_after)}` : r.replied_at ? `replied ${formatWhen(r.replied_at)}` : ''}
                    {r.reactivated_lead_id && <Link href={`/staff/leads/${r.reactivated_lead_id}`} className="ml-1 font-medium text-success hover:underline">lead reopened →</Link>}</td>
                  <td className="px-2 py-2.5 text-right">{demo && r.status === 'queued' && <SimulateReply phone={r.address} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="text-sm text-muted-ink">{c.status === 'sent' ? 'Nobody matched.' : 'Recipients are chosen when the campaign is sent.'}</p>}
        {demo && list.some((r) => r.status === 'queued') && <p className="mt-3 text-xs text-muted-ink">Demo: the reply buttons stand in for the customer answering on WhatsApp.</p>}
      </Panel>
    </>
  )
}
