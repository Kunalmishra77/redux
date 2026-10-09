import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Clock } from 'lucide-react'
import { requirePortalUser } from '@/lib/data/portal'
import { photoUrls } from '@/lib/data/photos'
import { createClient } from '@/lib/supabase/server'
import { SelfAssessmentWizard, type WizardFitting } from './wizard'

export const metadata: Metadata = { title: 'Self-assessment' }

// CR-001 phase 4 (D27) — the customer photographs their own fittings (ADR-015, BR-S10). Everything
// is read through the customer's RLS: their own survey, its fittings and photos.
export default async function SelfAssessmentPage({ params }: PageProps<'/portal/self-assessment/[id]'>) {
  const { id } = await params
  const user = await requirePortalUser(`/portal/self-assessment/${id}`)
  const supabase = await createClient()
  const { data: s } = await supabase.from('surveys')
    .select('id, mode, status, review_status, info_request, slot_end_at, submitted_at, property:properties(name, unit_label)')
    .eq('id', id).neq('mode', 'onsite').maybeSingle()
  if (!s) notFound()
  const survey = s as unknown as { id: string; mode: string; status: string; review_status: string | null; info_request: string | null; slot_end_at: string; submitted_at: string | null
    property: { name: string; unit_label: string } | null }
  const [{ data: fits }, { data: types }, { data: finishes }, { data: flags }, { data: hours }] = await Promise.all([
    supabase.from('fittings').select('id, unit_label, fitting_type_id, current_finish_id, notes, conds:fitting_conditions(condition_flag_id), photos:fitting_photos(slot, storage_path, uploaded_at)').eq('survey_id', id).order('created_at'),
    supabase.from('fitting_types').select('id, name').eq('is_active', true).order('sort_order'),
    supabase.from('finishes').select('id, name').eq('is_active', true).order('name'),
    supabase.from('condition_flags').select('id, name').eq('is_active', true).order('sort_order'),
    supabase.rpc('self_assessment_turnaround_hours'),
  ])
  const rows = (fits ?? []) as unknown as { id: string; unit_label: string | null; fitting_type_id: string; current_finish_id: string | null; notes: string | null
    conds: { condition_flag_id: string }[]; photos: { slot: string; storage_path: string; uploaded_at: string }[] }[]
  // the latest photo per slot (a retake adds a newer one; nothing is deleted)
  const latest = (ps: typeof rows[number]['photos']) => {
    const m = new Map<string, string>()
    for (const p of [...ps].sort((a, b) => a.uploaded_at.localeCompare(b.uploaded_at))) m.set(p.slot, p.storage_path)
    return m
  }
  const urls = await photoUrls(rows.flatMap((r) => [...latest(r.photos).values()]), 'survey-photos', 320)
  const fittings: WizardFitting[] = rows.map((r) => ({
    id: r.id, unit_label: r.unit_label ?? '', fitting_type_id: r.fitting_type_id, current_finish_id: r.current_finish_id ?? '', notes: r.notes ?? '',
    condition_ids: r.conds.map((c) => c.condition_flag_id),
    photos: Object.fromEntries([...latest(r.photos)].map(([slot, path]) => [slot, urls.get(path) ?? ''])),
  }))
  const masters = (types ?? []) as { id: string; name: string }[]
  const noun = survey.property?.unit_label === 'Bathroom' ? 'Bathroom' : 'Room'
  const open = survey.status === 'scheduled' || survey.status === 'in_progress'
  const sla = Number(hours ?? 24)

  return (
    <div className="space-y-5">
      <Link href="/portal" className="inline-flex items-center gap-1 text-sm font-medium text-redux-blue hover:underline"><ArrowLeft className="size-4" aria-hidden /> Home</Link>
      <header>
        <p className="eyebrow text-redux-blue">Free self-assessment</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">{survey.property?.name ?? user.customers[0]?.name}</h1>
        <p className="mt-1 text-sm text-muted-ink">
          {open ? <>For each tap, mixer or shower: say where it is, what it is, and add four photos. We send your assessment report and proposal within {sla} hours of submitting.</>
            : survey.review_status === 'priced' ? 'Your assessment is done — your proposal is in Proposals.' : `Submitted. Your report and proposal will be ready within ${sla} hours.`}
        </p>
      </header>
      {survey.review_status === 'needs_info' && survey.info_request && (
        <div className="rounded-xl border border-warning/30 bg-warning-bg p-4 text-sm text-ink"><p className="font-semibold">We need a little more</p><p className="mt-1">{survey.info_request}</p></div>
      )}
      {!open && (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-white p-4 shadow-card">
          {survey.review_status === 'priced' ? <CheckCircle2 className="size-6 text-success" aria-hidden /> : <Clock className="size-6 text-redux-blue" aria-hidden />}
          <p className="text-sm text-ink">{fittings.length} fittings sent{survey.submitted_at ? ` on ${new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(survey.submitted_at))}` : ''}.</p>
        </div>
      )}
      <SelfAssessmentWizard surveyId={id} open={open} noun={noun} fittings={fittings} types={masters} finishes={finishes ?? []} flags={flags ?? []} />
    </div>
  )
}
