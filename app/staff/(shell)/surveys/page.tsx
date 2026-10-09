import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarDays, Camera, MapPin } from 'lucide-react'
import { EmptyState, formatWhen, PageHeader, StatusPill, type PillTone } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { nowMs } from '@/lib/services/clock'

export const metadata: Metadata = { title: 'Surveys' }

const STATUS: Record<string, { label: string; tone: PillTone }> = {
  scheduled: { label: 'Scheduled', tone: 'neutral' }, checked_in: { label: 'On site', tone: 'progress' },
  in_progress: { label: 'In progress', tone: 'progress' }, submitted: { label: 'Submitted', tone: 'done' }, cancelled: { label: 'Cancelled', tone: 'failed' },
}

type Row = {
  id: string; scheduled_at: string; slot_end_at: string; status: string; submitted_at: string | null
  mode: string; review_status: string | null; review_due_at: string | null
  property: { name: string; address: string; city: { name: string } | null } | null
  surveyor: { full_name: string } | null; lead: { id: string; name: string | null } | null
  fittings: { count: number }[]
}

// B16 — the free-survey schedule, upcoming first. Surveyors see only their own (P2, RLS).
export default async function SurveysPage() {
  const user = await requireRole(['super_admin', 'cc_exec', 'surveyor'])
  const supabase = await createClient()
  const { data } = await supabase.from('surveys')
    .select('id, scheduled_at, slot_end_at, status, submitted_at, mode, review_status, review_due_at, property:properties(name, address, city:cities(name)), surveyor:profiles!surveys_surveyor_id_fkey(full_name), lead:leads(id, name), fittings(count)')
    .order('scheduled_at', { ascending: false })
  const all = (data ?? []) as unknown as Row[]
  const rows = all.filter((r) => r.mode === 'onsite')
  // BR-S11: self-assessments, the ones waiting on us first (oldest due date first)
  const selfs = all.filter((r) => r.mode !== 'onsite' && r.status !== 'cancelled')
    .sort((a, b) => (a.review_status === 'awaiting' ? 0 : 1) - (b.review_status === 'awaiting' ? 0 : 1) || (a.review_due_at ?? a.scheduled_at).localeCompare(b.review_due_at ?? b.scheduled_at))
  const now = new Date(nowMs()).toISOString()
  const upcoming = rows.filter((r) => r.scheduled_at >= now && r.status !== 'cancelled').reverse()
  const past = rows.filter((r) => r.scheduled_at < now || r.status === 'cancelled')

  const table = (list: Row[]) => (
    <div className="relative overflow-x-auto rounded-lg border border-line bg-white shadow-card">
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
              <td className="px-4 py-3 text-muted-ink">{s.surveyor?.full_name ?? '—'}</td>
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
      {selfs.length > 0 ? (
        <section className="mb-8"><h2 className="eyebrow mb-2 text-redux-blue">Self-assessments · <span className="num">{selfs.filter((s) => s.review_status === 'awaiting').length}</span> to review</h2>
          <div className="relative overflow-x-auto rounded-lg border border-line bg-white shadow-card">
            <table className="w-full min-w-[40rem] text-sm">
              <thead><tr className="border-b border-line bg-surface text-left">{['Property', 'Fittings', 'Where it is', 'Report due'].map((h) => <th key={h} className="eyebrow px-4 py-3 text-muted-ink">{h}</th>)}</tr></thead>
              <tbody>
                {selfs.map((s) => {
                  const late = s.review_status === 'awaiting' && s.review_due_at && s.review_due_at < now
                  const where = s.review_status === 'priced' ? 'Quoted' : s.review_status === 'awaiting' ? 'Submitted — to review' : s.review_status === 'needs_info' ? 'More info asked' : 'With the customer'
                  return (
                    <tr key={s.id} className="border-b border-line last:border-0 hover:bg-select">
                      <td className="px-4 py-3"><Link href={`/staff/surveys/${s.id}`} className="inline-flex items-center gap-1.5 font-semibold text-ink hover:text-redux-blue"><Camera className="size-3.5 text-redux-blue" aria-hidden />{s.property?.name}</Link>
                        <p className="text-xs text-muted-ink">{s.lead?.name ?? ''}{s.mode === 'video' ? ' · with video call' : ''}</p></td>
                      <td className="num px-4 py-3 text-muted-ink">{s.fittings[0]?.count || '—'}</td>
                      <td className="px-4 py-3"><StatusPill tone={s.review_status === 'awaiting' ? 'waiting' : s.review_status === 'priced' ? 'done' : 'neutral'}>{where}</StatusPill></td>
                      <td className={`num px-4 py-3 whitespace-nowrap ${late ? 'font-semibold text-danger' : 'text-muted-ink'}`}>{s.review_status === 'awaiting' && s.review_due_at ? `${late ? 'Overdue · ' : ''}${formatWhen(s.review_due_at)}` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
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
