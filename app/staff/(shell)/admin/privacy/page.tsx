import type { Metadata } from 'next'
import { ShieldCheck } from 'lucide-react'
import { formatWhen, Kpi, PageHeader, Panel, StatusPill, type PillTone } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { nowMs } from '@/lib/services/clock'

export const metadata: Metadata = { title: 'Privacy (DPDP)' }

const PURPOSE: Record<string, string> = { service: 'Service', marketing: 'Marketing', call_recording: 'Call recording', photo_marketing: 'Photos in marketing' }
const DSR_TONE: Record<string, PillTone> = { received: 'waiting', in_progress: 'progress', completed: 'positive', rejected: 'failed' }

// B39 — the consent ledger (append-only; a withdrawal is a new row) and data-subject requests with
// their statutory clock (DPDP Act 2023).
export default async function PrivacyPage() {
  await requireRole(['super_admin'])
  const supabase = await createClient()
  const [{ data: consents }, { data: dsrs }, { data: notice }, { data: incidents }] = await Promise.all([
    supabase.from('consent_records').select('id, subject_phone, purpose, granted, notice_version, method, granted_at').order('granted_at', { ascending: false }).limit(300),
    supabase.from('dsr_requests').select('id, type, subject_phone, status, details, due_at, completed_at, created_at').order('created_at', { ascending: false }),
    supabase.from('privacy_notices').select('version, language, effective_from').eq('is_active', true),
    supabase.from('incidents').select('id, title, discovered_at, report_due_at, closed_at').order('discovered_at', { ascending: false }),
  ])
  const c = consents ?? []
  const by = (p: string) => c.filter((x) => x.purpose === p)
  const rate = (p: string) => { const rows = by(p); return rows.length ? Math.round((rows.filter((x) => x.granted).length / rows.length) * 100) : 0 }
  const now = nowMs()
  const openDsr = (dsrs ?? []).filter((d) => ['received', 'in_progress'].includes(d.status))
  return (
    <>
      <PageHeader back={{ href: '/staff/admin', label: 'Admin' }} title="Privacy (DPDP)" description="Who agreed to what, under which notice — and every request to see, correct or erase their data."
        actions={<span className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm ring-1 ring-line"><ShieldCheck className="size-4 text-success" aria-hidden /> Notice {notice?.map((n) => `v${n.version} (${n.language})`).join(', ') || '—'}</span>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Consent records" value={c.length.toLocaleString('en-IN')} hint="Append-only ledger" />
        <Kpi label="Marketing opt-in" value={`${rate('marketing')}%`} hint="Unticked by default" />
        <Kpi label="Open data requests" value={openDsr.length} hint={openDsr.length ? `Next due ${formatWhen(openDsr.map((d) => d.due_at).sort()[0]!, false)}` : 'None waiting'} />
        <Kpi label="Incidents" value={(incidents ?? []).filter((i) => !i.closed_at).length} hint="Open breach reports" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Data-subject requests" bodyClassName="p-0">
          {(dsrs ?? []).length === 0 ? <p className="p-5 text-sm text-muted-ink">No requests yet. Customers raise them from their portal; staff can log one received by phone.</p> : (
            <ul className="divide-y divide-line">
              {dsrs!.map((d) => {
                const late = !d.completed_at && new Date(d.due_at).getTime() < now
                return (
                  <li key={d.id} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
                    <div><p className="font-medium text-ink capitalize">{d.type.replace('_', ' ')} · <span className="num">{d.subject_phone}</span></p>{d.details && <p className="text-xs text-muted-ink">{d.details}</p>}</div>
                    <div className="text-right"><StatusPill tone={DSR_TONE[d.status] ?? 'neutral'}>{d.status.replace('_', ' ')}</StatusPill>
                      <p className={`mt-1 text-xs ${late ? 'font-semibold text-danger' : 'text-muted-ink'}`}>{d.completed_at ? `Done ${formatWhen(d.completed_at, false)}` : `Due ${formatWhen(d.due_at, false)}`}</p></div>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
        <Panel title="Consent ledger" bodyClassName="p-0">
          <div className="max-h-[28rem] overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {c.slice(0, 80).map((x) => (
                  <tr key={x.id} className="border-b border-line last:border-0">
                    <td className="num px-4 py-2 text-xs">{x.subject_phone ?? '—'}</td>
                    <td className="px-4 py-2 text-xs text-ink">{PURPOSE[x.purpose]}</td>
                    <td className="px-4 py-2 text-xs">{x.granted ? <span className="text-success">Granted</span> : <span className="text-danger">Withdrawn / refused</span>}</td>
                    <td className="px-4 py-2 text-xs text-muted-ink">{x.method.replace('_', ' ')} · v{x.notice_version}</td>
                    <td className="px-4 py-2 text-right text-xs whitespace-nowrap text-faint">{formatWhen(x.granted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  )
}
