import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ClipboardCheck } from 'lucide-react'
import { EmptyState, PageHeader } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { loadJob, unitNoun } from '@/lib/data/jobs'
import { HandoverForm } from './handover-form'

export const metadata: Metadata = { title: 'Handover' }

// B25 — leak, operation and finish must all pass before a room returns to service (D11-07). Signing
// off generates the warranty cards from the quote's frozen terms (BR-J4, BR-Q3).
export default async function HandoverPage({ params, searchParams }: PageProps<'/staff/jobs/[id]/handover'>) {
  await requireRole(['super_admin', 'surveyor'])
  const { id } = await params
  const { unit } = await searchParams
  const loaded = await loadJob(id)
  if (!loaded) notFound()
  const { job, rooms } = loaded
  const noun = unitNoun(job.customer?.type)
  const ready = rooms.filter((r) => r.current_stage === 'refit_test' && r.status !== 'blocked').map((r) => ({ id: r.id, label: r.label }))
  return (
    <>
      <Link href={`/staff/jobs/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-redux-blue hover:underline"><ArrowLeft className="size-4" aria-hidden /> {job.job_no}</Link>
      <PageHeader eyebrow="Handover & sign-off" title={job.property?.name ?? 'Handover'} description={`${noun}s at refit & test can be handed back once every check passes.`} />
      {ready.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title={`No ${noun.toLowerCase()} is ready`} body="A room is ready for handover once it reaches refit & test and isn’t blocked." />
      ) : (
        <HandoverForm jobId={id} noun={noun} rooms={ready} initial={typeof unit === 'string' && ready.some((r) => r.id === unit) ? unit : ready[0]!.id} />
      )}
    </>
  )
}
