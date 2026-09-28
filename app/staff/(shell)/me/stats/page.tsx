import type { Metadata } from 'next'
import { CalendarCheck, Percent, Phone, Trophy } from 'lucide-react'
import { Kpi, PageHeader, Panel } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { nowMs } from '@/lib/services/clock'

export const metadata: Metadata = { title: 'My stats' }

// B15 / D4-09 — an executive's own numbers only (roles: never another executive's stats).
export default async function MyStatsPage() {
  const user = await requireRole(['cc_exec', 'super_admin'])
  const supabase = await createClient()
  const since = new Date(nowMs() - 30 * 86_400_000).toISOString()
  const [{ data: leads }, { data: calls }] = await Promise.all([
    supabase.from('leads').select('id, status, created_at').eq('assigned_to', user.id),
    supabase.from('calls').select('id, started_at, duration_sec, outcome:call_outcomes(marks_contacted)').eq('agent_id', user.id).gte('started_at', since),
  ])
  const mine = leads ?? []
  const callsList = calls ?? []
  const booked = mine.filter((l) => ['survey_booked', 'surveyed', 'quoted', 'won'].includes(l.status)).length
  const won = mine.filter((l) => l.status === 'won').length
  const reached = callsList.filter((c) => (c.outcome as unknown as { marks_contacted: boolean } | null)?.marks_contacted).length
  const talk = callsList.reduce((s, c) => s + (c.duration_sec ?? 0), 0)

  // calls per day, last 14 days
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(nowMs() - (13 - i) * 86_400_000)
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d)
    return { key, label: new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' }).format(d),
      n: callsList.filter((c) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(c.started_at)) === key).length }
  })
  const max = Math.max(1, ...days.map((d) => d.n))

  return (
    <>
      <PageHeader title="My stats" description="Last 30 days — your own numbers." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Calls made" value={callsList.length} icon={Phone} hint={`${reached} reached · ${Math.round(talk / 60)} min talk time`} />
        <Kpi label="Surveys booked" value={booked} icon={CalendarCheck} hint={`of ${mine.length} leads assigned`} />
        <Kpi label="Lead → survey" value={mine.length ? `${Math.round((booked / mine.length) * 100)}%` : '—'} icon={Percent} />
        <Kpi label="Won" value={won} icon={Trophy} hint="Jobs from your leads" />
      </div>
      <Panel title="Calls per day" className="mt-6">
        <div className="flex h-44 items-end gap-2" role="img" aria-label="Calls per day over the last 14 days">
          {days.map((d) => (
            <div key={d.key} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="num text-[11px] text-muted-ink">{d.n || ''}</span>
              <div className="w-full rounded-t-sm bg-redux-blue" style={{ height: `${(d.n / max) * 120}px`, minHeight: d.n ? 4 : 0 }} />
              <span className="text-[10px] text-faint">{d.label}</span>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
