import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { photoUrls } from '@/lib/data/photos'

// CR-001 phase 2 (D25) — data for the customer reports. Access is decided first, by RLS, with the
// caller's own client (can they see this survey / job?). Only then is the report assembled with the
// service role, scoped to that one record — reports need master names (fitting types, conditions)
// and the team member's name, which customer RLS rightly does not expose table-wide.

export type ReportFitting = {
  id: string; unit: string; type: string; brand: string | null; finish: string | null; conditions: string[]
  line: { description: string; price: number; eurobrass: number | null; market: number } | null
  before: string | null; after: string | null
}

async function fittingsFor(surveyIds: string[], quoteId: string | null, withAfter: boolean) {
  const admin = createAdminClient()
  const [{ data: fittings }, { data: lines }] = await Promise.all([
    admin.from('fittings').select('id, unit_label, ft:fitting_types(name), brand:brands(name), finish:finishes(name), conds:fitting_conditions(flag:condition_flags(name)), photos:fitting_photos(slot, storage_path)')
      .in('survey_id', surveyIds).order('unit_label'),
    quoteId ? admin.from('quotation_lines').select('fitting_id, description, line_total, price_replace_eurobrass, market_price').eq('quotation_id', quoteId) : Promise.resolve({ data: [] }),
  ])
  const rows = (fittings ?? []) as unknown as { id: string; unit_label: string | null; ft: { name: string } | null; brand: { name: string } | null; finish: { name: string } | null
    conds: { flag: { name: string } | null }[]; photos: { slot: string; storage_path: string }[] }[]
  const after = new Map<string, string>()
  if (withAfter && rows.length) {
    const { data } = await admin.from('handover_photos').select('fitting_id, storage_path').in('fitting_id', rows.map((r) => r.id))
    for (const h of data ?? []) if (h.fitting_id) after.set(h.fitting_id, h.storage_path)
  }
  const paths = [...rows.map((r) => r.photos.find((p) => p.slot === 'front')?.storage_path), ...after.values()].filter(Boolean) as string[]
  const urls = await photoUrls(paths, 'survey-photos', 640)
  const lineBy = new Map(((lines ?? []) as { fitting_id: string | null; description: string; line_total: number; price_replace_eurobrass: number | null; market_price: number }[]).map((l) => [l.fitting_id, l]))
  return rows.map<ReportFitting>((r) => {
    const l = lineBy.get(r.id)
    const front = r.photos.find((p) => p.slot === 'front')?.storage_path
    const a = after.get(r.id)
    return {
      id: r.id, unit: r.unit_label ?? '—', type: r.ft?.name ?? 'Fitting', brand: r.brand?.name ?? null, finish: r.finish?.name ?? null,
      conditions: r.conds.map((c) => c.flag?.name).filter(Boolean) as string[],
      line: l ? { description: l.description, price: Number(l.line_total), eurobrass: l.price_replace_eurobrass === null ? null : Number(l.price_replace_eurobrass), market: Number(l.market_price) } : null,
      before: front ? urls.get(front) ?? null : null, after: a ? urls.get(a) ?? null : null,
    }
  })
}

/** Assessment report for one survey, if the caller can see it and its proposal has been sent. */
export async function loadAssessmentReport(surveyId: string) {
  const supabase = await createClient()
  const { data: visible } = await supabase.from('surveys').select('id').eq('id', surveyId).eq('status', 'submitted').maybeSingle()
  if (!visible) return null
  const admin = createAdminClient()
  const { data: s } = await admin.from('surveys')
    .select('id, submitted_at, scheduled_at, property:properties(name, address, customer_id, customer:customers(name, type)), surveyor:profiles!surveys_surveyor_id_fkey(full_name), quotations(id, quote_no, version, status, total, market_total, you_save, created_at)')
    .eq('id', surveyId).single()
  const survey = s as unknown as { id: string; submitted_at: string | null; scheduled_at: string
    property: { name: string; address: string; customer_id: string; customer: { name: string; type: string } | null } | null; surveyor: { full_name: string } | null
    quotations: { id: string; quote_no: string; version: number; status: string; total: number; market_total: number; you_save: number; created_at: string }[] }
  // the latest proposal the customer has been sent (never a draft, BR-Q7 / item 12)
  const quote = survey.quotations.filter((q) => !['draft', 'pending_approval'].includes(q.status)).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
  if (!quote) return null
  const fittings = await fittingsFor([surveyId], quote.id, false)
  return { survey, quote, fittings, customerId: survey.property?.customer_id ?? null }
}

/** Completion report or warranty certificate for one job, if the caller can see it and it is complete. */
export async function loadJobReport(jobId: string) {
  const supabase = await createClient()
  const { data: visible } = await supabase.from('jobs').select('id').eq('id', jobId).maybeSingle()
  if (!visible) return null
  const admin = createAdminClient()
  const { data: j } = await admin.from('jobs')
    .select('id, job_no, status, actual_start, actual_end, quotation_id, customer_id, property:properties(name, address, customer:customers(name, type)), quote:quotations(quote_no, version, survey_id, terms_text), units:job_units(id, back_in_service_at, pu:property_units(label), handover:handovers(customer_name, leak_check, operation_check, finish_check, completed_at))')
    .eq('id', jobId).single()
  const job = j as unknown as { id: string; job_no: string; status: string; actual_start: string | null; actual_end: string | null; quotation_id: string; customer_id: string
    property: { name: string; address: string; customer: { name: string; type: string } | null } | null
    quote: { quote_no: string; version: number; survey_id: string; terms_text: string | null } | null
    units: { id: string; back_in_service_at: string | null; pu: { label: string } | null; handover: { customer_name: string; leak_check: boolean; operation_check: boolean; finish_check: boolean; completed_at: string } | { customer_name: string; leak_check: boolean; operation_check: boolean; finish_check: boolean; completed_at: string }[] | null }[] }
  const { data: warranties } = await admin.from('warranties')
    .select('id, card_no, kind, valid_from, valid_until, job_unit_id, fitting_id, terms_text, fitting:fittings(unit_label, ft:fitting_types(name), finish:finishes(name))')
    .eq('job_id', jobId).order('card_no')
  const fittings = job.quote ? await fittingsFor([job.quote.survey_id], job.quotation_id, true) : []
  return { job, fittings, customerId: job.customer_id, warranties: (warranties ?? []) as unknown as { id: string; card_no: string; kind: string; valid_from: string; valid_until: string; terms_text: string
    fitting: { unit_label: string | null; ft: { name: string } | null; finish: { name: string } | null } | null }[] }
}
