import type { Metadata } from 'next'
import { formatWhen, StatusPill } from '@/components/patterns'
import { createClient } from '@/lib/supabase/server'
import { requirePortalUser } from '@/lib/data/portal'
import { PrivacyControls } from './privacy-controls'

export const metadata: Metadata = { title: 'My data' }

const PURPOSE: Record<string, string> = { service: 'To deliver the service you asked for', marketing: 'Offers and updates from REDUX', call_recording: 'Recording calls for quality', photo_marketing: 'Using photos of your fittings in our marketing' }

// D10s — DPDP rights in plain words: download, correct, withdraw, erase — and what must be kept, why.
export default async function MyData() {
  const user = await requirePortalUser()
  const supabase = await createClient()
  const [{ data: consents }, { data: requests }] = await Promise.all([
    supabase.from('consent_records').select('purpose, granted, granted_at, notice_version').order('granted_at', { ascending: false }),
    supabase.from('dsr_requests').select('id, type, status, created_at, due_at, response').order('created_at', { ascending: false }),
  ])
  // the latest record per purpose is the current state (the ledger is append-only)
  const current = new Map<string, { granted: boolean; granted_at: string; notice_version: string }>()
  for (const c of consents ?? []) if (!current.has(c.purpose)) current.set(c.purpose, c)
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">My data</h1>
        <p className="mt-1 text-sm text-muted-ink">Your rights under India’s Digital Personal Data Protection Act. We respond to every request within 30 days.</p>
      </div>
      <section className="rounded-xl border border-line bg-white p-5 shadow-card">
        <h2 className="mb-3 font-semibold text-ink">What you’ve agreed to</h2>
        {current.size === 0 ? <p className="text-sm text-muted-ink">No consents on record.</p> : (
          <ul className="divide-y divide-line">
            {[...current.entries()].map(([p, c]) => (
              <li key={p} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span><span className="text-ink">{PURPOSE[p] ?? p}</span><span className="block text-xs text-faint">Notice v{c.notice_version} · {formatWhen(c.granted_at, false)}</span></span>
                <StatusPill tone={c.granted ? 'positive' : 'neutral'}>{c.granted ? 'Yes' : 'No'}</StatusPill>
              </li>
            ))}
          </ul>
        )}
      </section>
      <PrivacyControls customers={user.customers} marketingOn={current.get('marketing')?.granted ?? false} />
      {(requests ?? []).length > 0 && (
        <section className="rounded-xl border border-line bg-white p-5 shadow-card">
          <h2 className="mb-3 font-semibold text-ink">Your requests</h2>
          <ul className="space-y-2 text-sm">
            {requests!.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3">
                <span><span className="text-ink capitalize">{r.type.replace('_', ' ')}</span><span className="block text-xs text-muted-ink">Raised {formatWhen(r.created_at, false)} · answer due {formatWhen(r.due_at, false)}</span>{r.response && <span className="block text-xs text-ink">{r.response}</span>}</span>
                <StatusPill tone={r.status === 'completed' ? 'positive' : r.status === 'rejected' ? 'failed' : 'waiting'}>{r.status.replace('_', ' ')}</StatusPill>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
