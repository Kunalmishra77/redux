import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FileText, Hammer, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatWhen, Money, PageHeader, Panel, StatusPill } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { DEMO_STATUS } from '@/lib/data/demos'
import { nowMs } from '@/lib/services/clock'
import { CloseDemo, DecideDemo, DemoOutcome, ScheduleDemo } from '../demo-controls'

export const metadata: Metadata = { title: 'Demo' }

type Demo = {
  id: string; demo_no: string; status: string; note: string | null; exception_reason: string | null; decision_note: string | null; decided_at: string | null
  scheduled_for: string | null; job_id: string | null; internal_cost: number | null; result: string | null; customer_rating: number | null; feedback: string | null
  converted_quote_id: string | null; converted_at: string | null; closed_note: string | null; created_at: string; lead_id: string | null
  customer: { id: string; name: string; tier: string | null } | null; property: { name: string; address: string } | null
  type: { name: string; cost_cap: number | null; max_fittings: number } | null
  requester: { full_name: string } | null; decider: { full_name: string } | null
  job: { job_no: string; status: string; current_stage: string } | null; quote: { quote_no: string; version: number; total: number } | null
}

// E22 (D28) — one demo from proposal to conversion (BR-D1…D4)
export default async function DemoPage({ params }: PageProps<'/staff/demos/[id]'>) {
  const user = await requireRole(['super_admin', 'cc_exec'])
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('demos')
    .select(`id, demo_no, status, note, exception_reason, decision_note, decided_at, scheduled_for, job_id, internal_cost, result, customer_rating, feedback,
      converted_quote_id, converted_at, closed_note, created_at, lead_id,
      customer:customers(id, name, tier), property:properties(name, address), type:demo_types(name, cost_cap, max_fittings),
      requester:profiles!demos_requested_by_fkey(full_name), decider:profiles!demos_decided_by_fkey(full_name),
      job:jobs(job_no, status, current_stage), quote:quotations!demos_converted_quote_id_fkey(quote_no, version, total)`)
    .eq('id', id).maybeSingle()
  if (!data) notFound()
  const d = data as unknown as Demo
  const { data: items } = await supabase.from('demo_items')
    .select('id, f:fittings(unit_label, pu:property_units(label), ft:fitting_types(name)), w:work_types(name), fin:finishes(name)').eq('demo_id', id)
  const isAdmin = user.role === 'super_admin'
  const st = DEMO_STATUS[d.status]!
  const overCap = d.internal_cost !== null && d.type?.cost_cap !== null && d.type?.cost_cap !== undefined && Number(d.internal_cost) > Number(d.type.cost_cap)
  const today = new Date(nowMs()).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

  return (
    <>
      <PageHeader back={{ href: '/staff/demos', label: 'Demos' }} eyebrow={`Free ${d.type?.name.toLowerCase() ?? 'demo'}`} title={d.demo_no}
        description={`${d.customer?.name ?? ''}${d.property?.name && d.property.name !== d.customer?.name ? ` · ${d.property.name}` : ''}`}
        actions={<div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={st.tone}>{st.label}</StatusPill>
          {d.customer && <Button size="sm" variant="outline" asChild><Link href={`/staff/accounts/${d.customer.id}`}>Account</Link></Button>}
          {d.job_id && <Button size="sm" variant="outline" asChild><Link href={`/staff/jobs/${d.job_id}`}><Hammer aria-hidden /> Job {d.job?.job_no}</Link></Button>}
        </div>} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          {d.status === 'proposed' && (
            <Panel title="Approval">
              <p className="mb-3 text-sm text-muted-ink">Proposed by {d.requester?.full_name ?? 'the team'} on {formatWhen(d.created_at, false)}. Every demo is approved by the Super Admin before it is scheduled.</p>
              {d.exception_reason && <p className="mb-3 rounded-md bg-warning-bg px-3 py-2 text-sm text-warning">Outside the usual rule — {d.exception_reason}</p>}
              {d.note && <p className="mb-3 text-sm text-ink">“{d.note}”</p>}
              {isAdmin ? <DecideDemo demoId={id} /> : <p className="text-sm text-muted-ink">Waiting for the Super Admin.</p>}
            </Panel>
          )}
          {d.status === 'approved' && (
            <Panel title="Schedule">
              <p className="mb-3 text-sm text-muted-ink">Approved by {d.decider?.full_name} {d.decided_at ? `on ${formatWhen(d.decided_at, false)}` : ''}. Picking a date opens the demo job and tells the customer on WhatsApp.</p>
              <ScheduleDemo demoId={id} today={today} />
            </Panel>
          )}
          {['scheduled', 'in_progress'].includes(d.status) && d.job && (
            <Panel title="Work">
              <p className="text-sm text-ink">Demo on <strong>{d.scheduled_for ? formatWhen(d.scheduled_for, false) : '—'}</strong> · job <Link className="num font-medium text-redux-blue hover:underline" href={`/staff/jobs/${d.job_id}`}>{d.job.job_no}</Link> is at <strong>{d.job.current_stage.replaceAll('_', ' ')}</strong>.</p>
              <p className="mt-1 text-xs text-muted-ink">Run it like any job: stages, handover, warranty cards. The demo completes when the job does.</p>
            </Panel>
          )}
          {['completed', 'converted', 'not_converted'].includes(d.status) && (
            <Panel title="Outcome">
              {d.status === 'converted' && d.quote && (
                <p className="mb-4 rounded-md bg-success/10 px-3 py-2 text-sm text-success">Converted — <Link className="font-semibold underline" href={`/staff/quotes/${d.converted_quote_id}`}>{d.quote.quote_no} v{d.quote.version}</Link> (<Money value={d.quote.total} paise="never" />) approved {d.converted_at ? formatWhen(d.converted_at, false) : ''}.</p>
              )}
              {d.status === 'completed' && <p className="mb-4 text-sm text-muted-ink">When the account approves a quotation, this demo is marked converted automatically.</p>}
              {d.customer_rating && <p className="mb-3 flex items-center gap-1 text-sm text-ink">Customer rating: {Array.from({ length: 5 }, (_, i) => <Star key={i} className={`size-4 ${i < d.customer_rating! ? 'fill-warning text-warning' : 'text-faint'}`} aria-hidden />)}</p>}
              <DemoOutcome demoId={id} isAdmin={isAdmin} value={{ result: d.result, internal_cost: d.internal_cost === null ? null : Number(d.internal_cost), feedback: d.feedback }} />
              {d.job_id && <Button size="sm" variant="outline" className="mt-4" asChild><Link href={`/staff/reports/completion/${d.job_id}`}><FileText aria-hidden /> Demo report</Link></Button>}
            </Panel>
          )}
          {['rejected', 'cancelled'].includes(d.status) && (
            <Panel title={d.status === 'rejected' ? 'Rejected' : 'Cancelled'}><p className="text-sm text-ink">{d.decision_note ?? d.closed_note}</p></Panel>
          )}
          {d.status === 'not_converted' && d.closed_note && <Panel title="Closed"><p className="text-sm text-ink">{d.closed_note}</p></Panel>}

          <Panel title={`Fittings (${items?.length ?? 0})`}>
            <ul className="divide-y divide-line text-sm">
              {((items ?? []) as unknown as { id: string; f: { unit_label: string | null; pu: { label: string } | null; ft: { name: string } | null } | null; w: { name: string } | null; fin: { name: string } | null }[]).map((i) => (
                <li key={i.id} className="flex justify-between gap-3 py-2"><span className="text-ink">Room {i.f?.pu?.label ?? i.f?.unit_label} · {i.f?.ft?.name}</span><span className="text-muted-ink">{i.w?.name}{i.fin ? ` → ${i.fin.name}` : ''}</span></li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="min-w-0 space-y-5">
          <Panel title="Investment">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-ink">Internal cost</dt><dd className="num font-semibold">{d.internal_cost !== null ? <Money value={d.internal_cost} paise="never" /> : 'Not recorded'}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-ink">Cost guide</dt><dd className="num">{d.type?.cost_cap ? <Money value={d.type.cost_cap} paise="never" /> : '—'}</dd></div>
              {overCap && <p className="rounded-md bg-warning-bg px-2.5 py-1.5 text-xs text-warning">Above the cost guide for this type.</p>}
              <div className="flex justify-between"><dt className="text-muted-ink">Account tier</dt><dd className="num font-bold text-redux-blue">{d.customer?.tier ?? '—'}</dd></div>
            </dl>
          </Panel>
          {['proposed', 'approved', 'scheduled'].includes(d.status) && <CloseDemo demoId={id} outcome="cancelled" />}
          {d.status === 'completed' && <CloseDemo demoId={id} outcome="not_converted" />}
        </div>
      </div>
    </>
  )
}
