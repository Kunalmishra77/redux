import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarDays, MapPin } from 'lucide-react'
import { EmptyState, formatWhen, PageHeader, StatusPill, type PillTone } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Surveys' }

const STATUS: Record<string, { label: string; tone: PillTone }> = {
  scheduled: { label: 'Scheduled', tone: 'neutral' }, checked_in: { label: 'On site', tone: 'progress' },
  in_progress: { label: 'In progress', tone: 'progress' }, submitted: { label: 'Submitted', tone: 'done' }, cancelled: { label: 'Cancelled', tone: 'failed' },
}

type Row = {
  id: string; scheduled_at: string; slot_end_at: string; status: string; submitted_at: string | null
  property: { name: string; address: string; city: { name: string } | null } | null
  surveyor: { full_name: string } | null; lead: { id: string; name: string | null } | null
  fittings: { count: number }[]
}

// B16 — the free-survey schedule, upcoming first. Surveyors see only their own (P2, RLS).
export default async function SurveysPage() {
  const user = await requireRole(['super_admin', 'cc_exec', 'surveyor'])
  const supabase = await createClient()
  const { data } = await supabase.from('surveys')
    .select('id, scheduled_at, slot_end_at, status, submitted_at, property:properties(name, address, city:cities(name)), surveyor:profiles!surveys_surveyor_id_fkey(full_name), lead:leads(id, name), fittings(count)')
    .order('scheduled_at', { ascending: false })
  const rows = (data ?? []) as unknown as Row[]
  const now = new Date().toISOString()
  const upcoming = rows.filter((r) => r.scheduled_at >= now && r.status !== 'cancelled').reverse()
  const past = rows.filter((r) => r.scheduled_at < now || r.status === 'cancelled')

  const table = (list: Row[]) => (
    <div className="overflow-hidden rounded-lg border border-line bg-white shadow-card">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-line bg-surface text-left">
          {['When', 'Property', 'Surveyor', 'Fittings', 'Status'].map((h) => <th key={h} className="eyebrow px-4 py-3 text-muted-ink">{h}</th>)}
        </tr></thead>
        <tbody>
          {list.map((s) => (
            <tr key={s.id} className="border-b border-line last:border-0 hover:bg-select">
              <td className="num px-4 py-3 whitespace-nowrap">{formatWhen(s.scheduled_at)}</td>
              <td className="px-4 py-3">
                <Link href={`/staff/surveys/${s.id}`} className="font-semibold text-ink hover:text-redux-blue">{s.property?.name}</Link>
                <p className="flex items-center gap-1 text-xs text-muted-ink"><MapPin className="size-3" aria-hidden />{s.property?.city?.name ?? s.property?.address}</p>
              </td>
              <td className="px-4 py-3 text-muted-ink">{s.surveyor?.full_name}</td>
              <td className="num px-4 py-3 text-muted-ink">{s.fittings[0]?.count || '—'}</td>
              <td className="px-4 py-3"><StatusPill tone={STATUS[s.status]!.tone}>{STATUS[s.status]!.label}</StatusPill></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <>
      <PageHeader title={user.role === 'surveyor' ? 'My surveys' : 'Surveys'} description="Free on-site assessments — always free, never charged." />
      {rows.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No surveys yet" body="Surveys appear here as soon as a care executive books one from a lead." />
      ) : (
        <div className="space-y-8">
          <section><h2 className="eyebrow mb-2 text-redux-blue">Upcoming · <span className="num">{upcoming.length}</span></h2>
            {upcoming.length ? table(upcoming) : <p className="text-sm text-muted-ink">Nothing booked ahead.</p>}</section>
          <section><h2 className="eyebrow mb-2 text-muted-ink">Done · <span className="num">{past.length}</span></h2>{table(past)}</section>
        </div>
      )}
    </>
  )
}
