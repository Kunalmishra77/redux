import type { Metadata } from 'next'
import Link from 'next/link'
import { LifeBuoy, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatWhen, StatusPill } from '@/components/patterns'
import { createClient } from '@/lib/supabase/server'
import { requirePortalUser } from '@/lib/data/portal'
import { SR_STATUS } from '@/lib/constants/statuses'

export const metadata: Metadata = { title: 'Service requests' }

// D9s — my requests and where each one is.
export default async function MyRequests() {
  await requirePortalUser()
  const supabase = await createClient()
  const { data } = await supabase.from('service_requests').select('id, request_no, subject, status, created_at, acknowledged_at, resolve_due_at, resolution_note').order('created_at', { ascending: false })
  const rows = data ?? []
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">Service requests</h1>
        <Button asChild><Link href="/portal/service-requests/new"><Plus aria-hidden /> Raise a request</Link></Button>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted-ink"><LifeBuoy className="mx-auto mb-2 size-6 text-redux-blue" aria-hidden />No requests yet. If anything isn’t right with a restored fitting, tell us here.</div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const st = SR_STATUS[r.status]!
            return (
              <li key={r.id} className="rounded-xl border border-line bg-white p-4 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="font-semibold text-ink">{r.subject}</p><p className="num text-xs text-muted-ink">{r.request_no} · raised {formatWhen(r.created_at)}</p></div>
                  <StatusPill tone={st.tone}>{st.label}</StatusPill>
                </div>
                <p className="mt-2 text-sm text-muted-ink">
                  {r.resolution_note ? <><strong className="text-ink">Resolved:</strong> {r.resolution_note}</>
                    : r.acknowledged_at ? `We’re on it — target ${formatWhen(r.resolve_due_at, false)}.` : 'Received. We’ll call you shortly.'}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
