import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, Ban, ClipboardCheck, FileText, LayoutGrid, ShieldCheck, Undo2, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatWhen, JOB_STAGES, Money, Panel, StageTracker, StatusPill, Timeline, type TimelineItem } from '@/components/patterns'
import { RoomBoard } from '@/components/features/jobs/room-board'
import { UnitActions } from '@/components/features/jobs/unit-actions'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { BLOCK_REASONS, JOB_STATUS, UNIT_STATUS } from '@/lib/constants/statuses'
import { loadJob, unitNoun } from '@/lib/data/jobs'

export const metadata: Metadata = { title: 'Job' }

const stageLabel = (k: string | null) => JOB_STAGES.find((s) => s.key === k)?.label ?? k ?? '—'

// B23 — stages, batches and delays. Rooms move one stage at a time (BR-J1); a blocked room stops the
// delay clock (BR-J2); handover generates the warranty cards (BR-J4).
export default async function JobPage({ params }: PageProps<'/staff/jobs/[id]'>) {
  const user = await requireRole(['super_admin', 'cc_exec', 'surveyor'])
  const { id } = await params
  const loaded = await loadJob(id)
  if (!loaded) notFound()
  const { job, batches, rooms } = loaded
  const supabase = await createClient()
  const [{ data: events }, { data: warranties }, { data: blocks }, { data: delayed }] = await Promise.all([
    supabase.from('job_stage_events').select('id, job_unit_id, from_stage, to_stage, actor_id, note, is_backward, backward_reason, occurred_at').eq('job_id', id).order('occurred_at', { ascending: false }).limit(30),
    supabase.from('warranties').select('id, kind, valid_until').eq('job_id', id),
    supabase.from('unit_blocks').select('id, job_unit_id, reason, note, blocked_from, blocked_to').in('job_unit_id', rooms.map((r) => r.id)).order('blocked_from', { ascending: false }),
    supabase.from('v_delayed_units').select('job_unit_id, planned_downtime_hours, effective_downtime_hours').eq('job_id', id),
  ])
  const actorIds = [...new Set((events ?? []).map((e) => e.actor_id).filter(Boolean))] as string[]
  const { data: actors } = actorIds.length ? await supabase.from('profiles').select('id, full_name').in('id', actorIds) : { data: [] }
  const who = (uid: string | null) => actors?.find((a) => a.id === uid)?.full_name ?? (uid ? 'Customer' : 'System')
  const roomLabel = (uid: string | null) => rooms.find((r) => r.id === uid)?.label ?? ''
  const noun = unitNoun(job.customer?.type)
  const isAdmin = user.role === 'super_admin'
  const canHandover = isAdmin || (user.role === 'surveyor' && job.quote?.survey?.surveyor_id === user.id)
  const st = JOB_STATUS[job.status]!
  const back = rooms.filter((r) => r.status === 'back_in_service').length
  // the job's window: its own dates, else the span of its batches
  const from = job.planned_start ?? batches.map((b) => b.planned_from).filter(Boolean).sort()[0] ?? null
  const to = job.planned_end ?? batches.map((b) => b.planned_to).filter(Boolean).sort().at(-1) ?? null
  const place = job.property?.name && job.property.name !== job.customer?.name ? ` · ${job.property.name}` : ''

  const timeline: TimelineItem[] = [
    ...(events ?? []).map((e) => ({
      id: e.id, at: e.occurred_at, actor: who(e.actor_id),
      icon: e.is_backward ? Undo2 : e.to_stage === 'warranty_active' ? ShieldCheck : e.to_stage === 'handover' ? ClipboardCheck : ArrowRight,
      title: e.job_unit_id ? <>{noun} {roomLabel(e.job_unit_id)}: {e.is_backward ? 'moved back to ' : ''}{stageLabel(e.to_stage)}</> : 'Job opened',
      body: e.backward_reason ?? e.note ?? undefined,
    })),
    ...(blocks ?? []).flatMap((b) => [
      { id: `b${b.id}`, at: b.blocked_from, icon: Ban, title: <>{noun} {roomLabel(b.job_unit_id)} blocked — {BLOCK_REASONS[b.reason]?.label.toLowerCase()} ({BLOCK_REASONS[b.reason]?.on})</>, body: b.note ?? undefined },
      ...(b.blocked_to ? [{ id: `u${b.id}`, at: b.blocked_to, icon: Unlock, title: <>{noun} {roomLabel(b.job_unit_id)} unblocked</> }] : []),
    ]),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 25)

  const groups = batches.length
    ? [...batches.map((b) => ({ key: b.id, name: b.name, dates: b.planned_from ? `${formatWhen(b.planned_from, false)} – ${b.planned_to ? formatWhen(b.planned_to, false) : '…'}` : null, rooms: rooms.filter((r) => r.batch_id === b.id) })),
       ...(rooms.some((r) => !r.batch_id) ? [{ key: 'none', name: 'Not in a batch', dates: null, rooms: rooms.filter((r) => !r.batch_id) }] : [])]
    : [{ key: 'all', name: `${noun}s`, dates: null, rooms }]

  return (
    <>
      <Link href="/staff/jobs" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-redux-blue hover:underline"><ArrowLeft className="size-4" aria-hidden /> Jobs</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-redux-blue">Job{job.is_pilot ? ' · Pilot' : ''}</p>
          <h1 className="num mt-1 text-[28px] leading-tight font-semibold text-ink">{job.job_no}</h1>
          <p className="mt-1 text-sm text-muted-ink">{job.customer?.name}{place}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={st.tone}>{st.label}</StatusPill>
          <Button variant="outline" asChild><Link href={`/staff/jobs/${id}/board`}><LayoutGrid aria-hidden /> {noun} board</Link></Button>
          <Button variant="outline" asChild><Link href={`/staff/quotes/${job.quotation_id}`}><FileText aria-hidden /> {job.quote?.quote_no} v{job.quote?.version}</Link></Button>
          {canHandover && rooms.some((r) => r.current_stage === 'refit_test' && r.status !== 'blocked') && <Button asChild><Link href={`/staff/jobs/${id}/handover`}><ClipboardCheck aria-hidden /> Handover</Link></Button>}
        </div>
      </div>

      <Panel className="mb-6">
        <StageTracker current={job.current_stage} />
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm sm:grid-cols-4">
          <div><dt className="eyebrow text-muted-ink">{noun}s back</dt><dd className="num mt-0.5 text-lg font-semibold">{back} / {rooms.length}</dd></div>
          <div><dt className="eyebrow text-muted-ink">Planned</dt><dd className="mt-0.5">{from ? `${formatWhen(from, false)} – ${to ? formatWhen(to, false) : '…'}` : 'Dates to confirm'}</dd></div>
          <div><dt className="eyebrow text-muted-ink">Order value</dt><dd className="mt-0.5 font-semibold"><Money value={job.quote?.total} paise="never" /></dd></div>
          <div><dt className="eyebrow text-muted-ink">Warranty cards</dt><dd className="num mt-0.5 text-lg font-semibold">{warranties?.length ?? 0}</dd></div>
        </dl>
      </Panel>

      {(delayed?.length ?? 0) > 0 && (
        <div className="mb-6 rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-sm text-danger">
          <strong>{delayed!.length} {noun.toLowerCase()}{delayed!.length > 1 ? 's' : ''} past planned downtime</strong> — blocked time is already excluded.{' '}
          {delayed!.map((d) => `${noun} ${roomLabel(d.job_unit_id)}: ${Number(d.effective_downtime_hours)}h of ${Number(d.planned_downtime_hours)}h`).join(' · ')}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          {groups.map((g) => (
            <Panel key={g.key} title={g.name} action={g.dates && <span className="text-xs text-muted-ink">{g.dates}</span>} bodyClassName="p-0">
              <table className="w-full text-sm">
                <tbody>
                  {g.rooms.map((r) => {
                    const us = UNIT_STATUS[r.status]!
                    return (
                      <tr key={r.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-3 font-semibold whitespace-nowrap text-ink">{noun} {r.label}</td>
                        <td className="px-4 py-3">
                          <StatusPill tone={us.tone}>{r.status === 'in_progress' ? stageLabel(r.current_stage) : us.label}</StatusPill>
                          {r.block && <p className="mt-1 text-xs text-danger">Waiting on {BLOCK_REASONS[r.block.reason]?.on}: {BLOCK_REASONS[r.block.reason]?.label.toLowerCase()}{r.block.note ? ` — ${r.block.note}` : ''}</p>}
                        </td>
                        <td className="hidden px-4 py-3 text-xs text-muted-ink md:table-cell">
                          {r.back_in_service_at ? `Back ${formatWhen(r.back_in_service_at)}` : r.downtime_from ? `Out since ${formatWhen(r.downtime_from)}` : r.planned_downtime_hours ? `${Number(r.planned_downtime_hours)}h planned` : ''}
                        </td>
                        <td className="px-4 py-3"><UnitActions jobId={id} unitId={r.id} label={r.label} stage={r.current_stage as never} status={r.status} isAdmin={isAdmin} canHandover={canHandover} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Panel>
          ))}
          <Panel title="At a glance"><RoomBoard units={rooms} noun={noun} /></Panel>
        </div>
        <Panel title="Timeline">
          {timeline.length ? <Timeline items={timeline} /> : <p className="text-sm text-muted-ink">Nothing has moved yet. The first step is removal and pickup.</p>}
        </Panel>
      </div>
    </>
  )
}
