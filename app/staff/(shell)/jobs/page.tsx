import type { Metadata } from 'next'
import Link from 'next/link'
import { Hammer } from 'lucide-react'
import { EmptyState, JOB_STAGES, PageHeader, StageTracker, StatusPill } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { JOB_STATUS } from '@/lib/constants/statuses'

export const metadata: Metadata = { title: 'Jobs' }

type Row = { id: string; job_no: string; status: string; current_stage: string; is_pilot: boolean; planned_start: string | null; planned_end: string | null
  customer: { name: string } | null; property: { name: string } | null; units: { status: string }[] }

// B22 — every job with its stage; the least advanced room sets the job's stage.
export default async function JobsPage({ searchParams }: PageProps<'/staff/jobs'>) {
  await requireRole(['super_admin', 'cc_exec', 'surveyor'])
  const { status } = await searchParams
  const supabase = await createClient()
  let query = supabase.from('jobs')
    .select('id, job_no, status, current_stage, is_pilot, planned_start, planned_end, customer:customers(name), property:properties(name), units:job_units(status)')
    .order('created_at', { ascending: false })
  if (typeof status === 'string' && status in JOB_STATUS) query = query.eq('status', status as 'planned')
  const { data } = await query
  const rows = (data ?? []) as unknown as Row[]
  const tabs = [['', 'All'], ['in_progress', 'In progress'], ['planned', 'Planned'], ['completed', 'Completed']] as const
  return (
    <>
      <PageHeader title="Jobs" description="Approved quotations become jobs. Each room moves through seven stages." />
      <nav className="mb-4 flex gap-1.5" aria-label="Filter by status">
        {tabs.map(([k, label]) => (
          <Link key={k} href={k ? `/staff/jobs?status=${k}` : '/staff/jobs'}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${(status ?? '') === k ? 'bg-redux-blue text-white' : 'bg-white text-muted-ink ring-1 ring-line hover:text-ink'}`}>{label}</Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState icon={Hammer} title="No jobs here" body="A job opens when the customer approves a quotation by OTP." />
      ) : (
        <div className="grid gap-4">
          {rows.map((j) => {
            const blocked = j.units.filter((u) => u.status === 'blocked').length
            const back = j.units.filter((u) => u.status === 'back_in_service').length
            const st = JOB_STATUS[j.status]!
            return (
              <Link key={j.id} href={`/staff/jobs/${j.id}`} className="block rounded-lg border border-line bg-white p-5 shadow-card transition hover:border-redux-blue/40">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="num font-semibold text-ink">{j.job_no}{j.is_pilot && <span className="ml-2 rounded-sm bg-redux-lime px-1.5 py-0.5 text-[11px] font-semibold text-redux-blue">PILOT</span>}</p>
                    <p className="text-sm text-muted-ink">{j.customer?.name}{j.property?.name && j.property.name !== j.customer?.name ? ` · ${j.property.name}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-ink"><span className="num font-semibold text-ink">{back}</span>/{j.units.length} rooms back</span>
                    {blocked > 0 && <StatusPill tone="failed">{blocked} blocked</StatusPill>}
                    <StatusPill tone={st.tone}>{st.label}</StatusPill>
                  </div>
                </div>
                <StageTracker current={j.current_stage} compact />
                <p className="mt-2 text-xs text-muted-ink">Stage {JOB_STAGES.findIndex((s) => s.key === j.current_stage) + 1} of 7 · {JOB_STAGES.find((s) => s.key === j.current_stage)?.label}</p>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
