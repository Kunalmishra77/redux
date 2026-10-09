import 'server-only'

import { createClient } from '@/lib/supabase/server'

// CR-001 phase 5 (D28) — what a demo can cover: fittings from the account's own submitted
// assessments (the database checks the same thing in propose_demo).
export type DemoCandidate = { id: string; unit: string; type: string; site: string; recommended: string | null }

export async function demoCandidates(customerId: string): Promise<DemoCandidate[]> {
  const supabase = await createClient()
  const { data: props } = await supabase.from('properties').select('id').eq('customer_id', customerId)
  if (!props?.length) return []
  const { data } = await supabase.from('fittings')
    .select('id, unit_label, pu:property_units(label), ft:fitting_types(name), s:surveys!inner(status, property:properties(name)), a:assessments(recommended)')
    .in('s.property_id', props.map((p) => p.id)).eq('s.status', 'submitted').order('unit_label')
  return ((data ?? []) as unknown as { id: string; unit_label: string | null; pu: { label: string } | null; ft: { name: string } | null
    s: { property: { name: string } | null } | null; a: { recommended: string } | { recommended: string }[] | null }[]).map((f) => ({
    id: f.id, unit: f.pu?.label ?? f.unit_label ?? '—', type: f.ft?.name ?? 'Fitting', site: f.s?.property?.name ?? '',
    recommended: (Array.isArray(f.a) ? f.a[0]?.recommended : f.a?.recommended) ?? null,
  }))
}

export const DEMO_STATUS: Record<string, { label: string; tone: 'waiting' | 'progress' | 'done' | 'failed' | 'neutral' | 'positive' }> = {
  proposed: { label: 'To approve', tone: 'waiting' }, approved: { label: 'Approved — to schedule', tone: 'progress' },
  rejected: { label: 'Rejected', tone: 'failed' }, scheduled: { label: 'Scheduled', tone: 'progress' },
  in_progress: { label: 'In progress', tone: 'progress' }, completed: { label: 'Done — awaiting order', tone: 'done' },
  converted: { label: 'Converted', tone: 'positive' }, not_converted: { label: 'Not converted', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
}
