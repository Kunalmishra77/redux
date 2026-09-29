import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { formatWhen, JOB_STAGES, StageTracker } from '@/components/patterns'
import { RoomBoard } from '@/components/features/jobs/room-board'
import { createClient } from '@/lib/supabase/server'
import { requirePortalUser } from '@/lib/data/portal'
import { loadJob, unitNoun } from '@/lib/data/jobs'

export const metadata: Metadata = { title: 'Job progress' }

const EXPLAIN: Record<string, string> = {
  dates_confirmed: 'Dates are agreed. Our team will remove the fittings on the first day.',
  removal_pickup: 'Fittings removed and on their way to the Eurobrass factory.',
  at_eurobrass: 'At the Eurobrass factory — stripping, re-plating and new cartridges.',
  quality_check: 'Every fitting is checked for finish and flow before it comes back.',
  refit_test: 'Back on your walls and pressure-tested.',
  handover: 'Signed off with you. Room back in service.',
  warranty_active: 'Done — your warranty cards are active.',
}

// D3s — the same seven stages and the same room board the REDUX team sees.
export default async function PortalJob({ params }: PageProps<'/portal/jobs/[id]'>) {
  await requirePortalUser()
  const { id } = await params
  const loaded = await loadJob(id)
  if (!loaded) notFound()
  const { job, batches, rooms } = loaded
  const noun = unitNoun(job.customer?.type)
  const supabase = await createClient()
  const { data: events } = await supabase.from('job_stage_events').select('id, to_stage, job_unit_id, occurred_at, is_backward').eq('job_id', id).order('occurred_at', { ascending: false }).limit(12)
  const at = JOB_STAGES.findIndex((s) => s.key === job.current_stage)
  return (
    <div className="space-y-6">
      <Link href="/portal" className="inline-flex items-center gap-1 text-sm font-medium text-redux-blue hover:underline"><ArrowLeft className="size-4" aria-hidden /> Home</Link>
      <div>
        <p className="eyebrow text-redux-blue">Job {job.job_no}</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">{job.property?.name}</h1>
      </div>
      <section className="rounded-xl border border-line bg-white p-5 shadow-card">
        <StageTracker current={job.current_stage} />
        <p className="mt-5 text-base font-semibold text-ink">Step {at + 1} of 7 · {JOB_STAGES[at]?.label}</p>
        <p className="text-sm text-muted-ink">{EXPLAIN[job.current_stage]}</p>
      </section>
      {batches.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-2">
          {batches.map((b) => (
            <div key={b.id} className="rounded-xl border border-line bg-white p-4 shadow-card">
              <p className="font-semibold text-ink">{b.name}</p>
              <p className="text-sm text-muted-ink">{b.planned_from ? `${formatWhen(b.planned_from, false)} – ${b.planned_to ? formatWhen(b.planned_to, false) : '…'}` : 'Dates to confirm'}</p>
            </div>
          ))}
        </section>
      )}
      <section>
        <h2 className="mb-3 font-semibold text-ink">{noun}s</h2>
        <RoomBoard units={rooms} noun={noun} />
        <p className="mt-3 text-xs text-muted-ink">A {noun.toLowerCase()} marked “blocked” is waiting on work outside REDUX’s scope; that time isn’t counted against the schedule.</p>
      </section>
      {(events?.length ?? 0) > 0 && (
        <section className="rounded-xl border border-line bg-white p-5 shadow-card">
          <h2 className="mb-3 font-semibold text-ink">Latest updates</h2>
          <ul className="space-y-2 text-sm">
            {events!.map((e) => (
              <li key={e.id} className="flex justify-between gap-3">
                <span className="text-ink">{e.job_unit_id ? `${noun} ${rooms.find((r) => r.id === e.job_unit_id)?.label}: ` : ''}{JOB_STAGES.find((s) => s.key === e.to_stage)?.label}</span>
                <span className="text-xs whitespace-nowrap text-muted-ink">{formatWhen(e.occurred_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
