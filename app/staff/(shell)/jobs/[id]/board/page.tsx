import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { RoomBoard } from '@/components/features/jobs/room-board'
import { requireRole } from '@/lib/auth/session'
import { UNIT_STATUS } from '@/lib/constants/statuses'
import { loadJob, unitNoun } from '@/lib/data/jobs'

export const metadata: Metadata = { title: 'Room status board' }

// B24 — per-property board, large enough to put on a screen in a meeting with the hotel.
export default async function BoardPage({ params }: PageProps<'/staff/jobs/[id]/board'>) {
  await requireRole(['super_admin', 'cc_exec', 'surveyor'])
  const { id } = await params
  const loaded = await loadJob(id)
  if (!loaded) notFound()
  const { job, rooms } = loaded
  const noun = unitNoun(job.customer?.type)
  const counts = Object.entries(UNIT_STATUS).map(([k, v]) => ({ ...v, key: k, n: rooms.filter((r) => r.status === k).length }))
  return (
    <>
      <Link href={`/staff/jobs/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-redux-blue hover:underline"><ArrowLeft className="size-4" aria-hidden /> {job.job_no}</Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-redux-blue">{noun} status board</p>
          <h1 className="mt-1 text-[28px] leading-tight font-semibold text-ink">{job.property?.name}</h1>
          <p className="mt-1 text-sm text-muted-ink">{job.customer?.name} · {job.job_no}</p>
        </div>
        <ul className="flex flex-wrap gap-2 text-sm">
          {counts.map((c) => <li key={c.key} className={`rounded-md border px-3 py-1.5 ${c.tile}`}><span className="num font-semibold">{c.n}</span> {c.label.toLowerCase()}</li>)}
        </ul>
      </div>
      <RoomBoard units={rooms} noun={noun} large />
      <p className="mt-6 text-xs text-muted-ink">A blocked {noun.toLowerCase()} names who it is waiting on. Time spent blocked is not counted as REDUX delay.</p>
    </>
  )
}
