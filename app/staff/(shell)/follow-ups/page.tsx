import type { Metadata } from 'next'
import Link from 'next/link'
import { AlarmClock, CheckCircle2 } from 'lucide-react'
import { EmptyState, formatRelative, formatWhen, PageHeader } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { DoneButton } from './done-button'

export const metadata: Metadata = { title: 'Follow-ups' }

// B12 — due and overdue first (D4-07); a missed follow-up also raises TN4 in the alerts.
export default async function FollowUpsPage() {
  const user = await requireRole(['cc_exec', 'super_admin'])
  const supabase = await createClient()
  let q = supabase.from('follow_ups')
    .select('id, due_at, note, lead:leads(id, name, phone, property_name), owner:profiles!follow_ups_assigned_to_fkey(full_name)')
    .is('completed_at', null).order('due_at')
  if (user.role === 'cc_exec') q = q.eq('assigned_to', user.id)
  const { data } = await q
  const rows = (data ?? []) as unknown as { id: string; due_at: string; note: string | null; lead: { id: string; name: string | null; phone: string; property_name: string | null } | null; owner: { full_name: string } | null }[]
  const now = new Date().toISOString()
  const overdue = rows.filter((r) => r.due_at < now)
  const later = rows.filter((r) => r.due_at >= now)

  const section = (title: string, list: typeof rows, late: boolean) => list.length > 0 && (
    <section className="mb-6">
      <h2 className={`eyebrow mb-2 ${late ? 'text-danger' : 'text-muted-ink'}`}>{title} · <span className="num">{list.length}</span></h2>
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white shadow-card">
        {list.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
            <AlarmClock className={`size-5 shrink-0 ${late ? 'text-danger' : 'text-redux-blue'}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <Link href={`/staff/leads/mine?id=${f.lead?.id}`} className="font-semibold text-ink hover:text-redux-blue">{f.lead?.property_name ?? f.lead?.name ?? f.lead?.phone}</Link>
              <p className="text-sm text-muted-ink">{f.note ?? 'Call back'}{user.role === 'super_admin' && f.owner ? ` · ${f.owner.full_name}` : ''}</p>
            </div>
            <span className={`num text-sm ${late ? 'font-semibold text-danger' : 'text-muted-ink'}`} title={formatWhen(f.due_at)}>{formatRelative(f.due_at)}</span>
            <DoneButton id={f.id} leadId={f.lead?.id} />
          </li>
        ))}
      </ul>
    </section>
  )

  return (
    <>
      <PageHeader title="Follow-ups" description="Call-backs you promised. Overdue ones are also in your alerts." />
      {rows.length === 0
        ? <EmptyState icon={CheckCircle2} title="No follow-ups due" body="Set one from any lead — it comes back to the top of your queue at that time." />
        : <>{section('Overdue', overdue, true)}{section('Coming up', later, false)}</>}
    </>
  )
}
