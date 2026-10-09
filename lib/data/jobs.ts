import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { BoardUnit } from '@/components/features/jobs/room-board'

export type JobUnit = BoardUnit & { batch_id: string | null; downtime_from: string | null; back_in_service_at: string | null; planned_downtime_hours: string | null }

/** A job with its batches and rooms; each room carries its open block (who it waits on). */
export async function loadJob(id: string) {
  const supabase = await createClient()
  const { data: job } = await supabase.from('jobs')
    .select('id, job_no, status, current_stage, is_pilot, kind, parent_job_id, planned_start, planned_end, actual_start, actual_end, quotation_id, customer:customers(id, name, type), property:properties(name, address), quote:quotations(quote_no, version, total, survey:surveys(surveyor_id))')
    .eq('id', id).maybeSingle()
  if (!job) return null
  const [{ data: batches }, { data: units }] = await Promise.all([
    supabase.from('job_batches').select('id, name, planned_from, planned_to, sort_order').eq('job_id', id).order('sort_order'),
    supabase.from('job_units')
      .select('id, batch_id, status, current_stage, downtime_from, back_in_service_at, planned_downtime_hours, pu:property_units(label), blocks:unit_blocks(reason, note, blocked_to)')
      .eq('job_id', id),
  ])
  const rooms: JobUnit[] = (units ?? []).map((u) => ({
    id: u.id, batch_id: u.batch_id, status: u.status, current_stage: u.current_stage, downtime_from: u.downtime_from,
    back_in_service_at: u.back_in_service_at, planned_downtime_hours: u.planned_downtime_hours as string | null,
    label: (u.pu as unknown as { label: string } | null)?.label ?? '—',
    block: (u.blocks as { reason: string; note: string | null; blocked_to: string | null }[]).find((b) => !b.blocked_to) ?? null,
  })).sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }))
  return { job: job as unknown as JobHead, batches: batches ?? [], rooms }
}

type JobHead = { id: string; job_no: string; status: string; current_stage: string; is_pilot: boolean; parent_job_id: string | null
  planned_start: string | null; planned_end: string | null; actual_start: string | null; actual_end: string | null; quotation_id: string | null; kind: string
  customer: { id: string; name: string; type: string } | null; property: { name: string; address: string | null } | null
  quote: { quote_no: string; version: number; total: string; survey: { surveyor_id: string } | null } | null }

/** "Room" for hotels, "Bathroom" for homes — the DB always says unit (glossary). */
export const unitNoun = (customerType?: string | null) => (customerType === 'home' ? 'Bathroom' : 'Room')
