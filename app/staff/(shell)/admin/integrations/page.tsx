import type { Metadata } from 'next'
import { AlertTriangle, CheckCircle2, CircleDashed, PlugZap } from 'lucide-react'
import { formatRelative, formatWhen, PageHeader, Panel, StatusPill, type PillTone } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { nowMs } from '@/lib/services/clock'

export const metadata: Metadata = { title: 'Integrations' }

const PROVIDER: Record<string, { name: string; source?: string; why: string }> = {
  meta: { name: 'Meta Lead Ads', source: 'meta_leadgen', why: 'Facebook & Instagram lead forms. A gap over 90 days loses leads for good — a 15-minute poll backs up the webhook.' },
  whatsapp: { name: 'WhatsApp Cloud API', source: 'whatsapp', why: 'Every customer message, template and delivery receipt.' },
  google_ads: { name: 'Google Ads lead forms', source: 'google_ads', why: 'Never answered with a 4XX — Google does not retry, and the lead would be lost.' },
  razorpay: { name: 'Razorpay', source: 'razorpay', why: 'Payment links, virtual accounts and captured payments.' },
  msg91: { name: 'MSG91 (OTP SMS)', why: 'Quote-approval and login OTPs by SMS, DLT-registered.' },
}
const WH_TONE: Record<string, PillTone> = { done: 'positive', pending: 'waiting', processing: 'progress', failed: 'failed', dead: 'failed' }

// B10 — integration health: when each provider last spoke to us, and every webhook that failed.
export default async function IntegrationsPage() {
  await requireRole(['super_admin'])
  const supabase = await createClient()
  const [{ data: accounts }, { data: events }] = await Promise.all([
    supabase.from('integration_accounts').select('id, provider, external_id, display_name, is_active, last_event_at').order('provider'),
    supabase.from('webhook_events').select('id, source, event_type, status, signature_ok, retry_count, last_error, received_at, processed_at').order('received_at', { ascending: false }).limit(50),
  ])
  const ev = events ?? []
  const now = nowMs()
  const demo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
  return (
    <>
      <PageHeader eyebrow="Admin" title="Integrations" description="Each provider’s last contact and the webhook queue. Webhooks are verified, stored and answered in under 200 ms; work happens in the queue." />
      {demo && <p className="mb-5 rounded-lg border border-line bg-white px-4 py-3 text-sm text-muted-ink"><strong className="text-ink">Demo:</strong> integrations are simulated — outgoing messages appear in the demo outbox. The webhook endpoints are live and verify signatures.</p>}
      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(PROVIDER).map(([key, p]) => {
          const acc = (accounts ?? []).filter((a) => a.provider === key)
          const last = acc.map((a) => a.last_event_at).filter(Boolean).sort().at(-1) ?? ev.find((e) => e.source === p.source)?.received_at ?? null
          const failed = ev.filter((e) => e.source === p.source && (e.status === 'failed' || e.status === 'dead')).length
          const stale = last ? now - new Date(last).getTime() > 7 * 86_400_000 : true
          const state = !acc.length ? 'off' : failed ? 'failing' : stale ? 'quiet' : 'ok'
          return (
            <Panel key={key}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{p.name}</p>
                  <p className="text-xs text-muted-ink">{acc.map((a) => a.display_name ?? a.external_id).filter(Boolean).join(' · ') || 'Not connected'}</p>
                </div>
                {state === 'ok' ? <CheckCircle2 className="size-5 text-success" aria-label="Healthy" />
                  : state === 'failing' ? <AlertTriangle className="size-5 text-danger" aria-label="Failing" />
                  : <CircleDashed className="size-5 text-faint" aria-label={state === 'off' ? 'Not connected' : 'Quiet'} />}
              </div>
              <p className="mt-3 text-sm text-ink">{last ? `Last contact ${formatRelative(last)}` : 'No contact yet'}{failed ? <span className="text-danger"> · {failed} failed</span> : null}</p>
              <p className="mt-2 text-xs text-muted-ink">{p.why}</p>
            </Panel>
          )
        })}
      </div>
      <h2 className="mb-3 text-base font-semibold text-ink">Recent webhooks</h2>
      {ev.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-line bg-white p-6 text-sm text-muted-ink"><PlugZap className="size-5" aria-hidden /> No webhooks received yet. They appear here the moment a provider calls.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-white shadow-card">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line bg-surface text-left">
              {['Received', 'Source', 'Event', 'Signature', 'Status', 'Note'].map((h) => <th key={h} className="eyebrow px-4 py-3 text-muted-ink">{h}</th>)}
            </tr></thead>
            <tbody>
              {ev.map((e) => (
                <tr key={e.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-xs whitespace-nowrap text-muted-ink">{formatWhen(e.received_at)}</td>
                  <td className="px-4 py-3 text-ink">{e.source.replace('_', ' ')}</td>
                  <td className="num px-4 py-3 text-xs">{e.event_type ?? '—'}</td>
                  <td className="px-4 py-3 text-xs">{e.signature_ok ? <span className="text-success">Verified</span> : <span className="text-danger">Rejected</span>}</td>
                  <td className="px-4 py-3"><StatusPill tone={WH_TONE[e.status] ?? 'neutral'}>{e.status}{e.retry_count ? ` · ${e.retry_count} retries` : ''}</StatusPill></td>
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-muted-ink">{e.last_error ?? (e.processed_at ? `Processed ${formatRelative(e.processed_at)}` : '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
