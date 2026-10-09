import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Crosshair, FileText, MapPin, Smartphone, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatWhen, IconCircle, Money, Panel, StatusPill } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { photoUrls } from '@/lib/data/photos'
import { CreateQuoteButton } from './create-quote-button'
import { AskForInfo, PriceFitting, ReviewerSelect } from './review-controls'
import { nowMs } from '@/lib/services/clock'

export const metadata: Metadata = { title: 'Survey' }

const TREATMENT: Record<string, string> = { restore_finish: 'Restore finish', repair_function: 'Repair function', replace_eurobrass: 'Replace (Eurobrass)', no_action: 'No action' }
const SLOTS = ['front', 'side', 'top', 'close_up'] as const

type Fitting = {
  id: string; unit_label: string | null; model: string | null; notes: string | null
  type: { name: string } | null; brand: { name: string } | null; finish: { name: string } | null
  photos: { id: string; slot: string; storage_path: string }[]
  conditions: { flag: { name: string } | null }[]
  assessment: { recommended: string; finish_id: string | null; price_recommended: string; price_replace_eurobrass: string; price_market_replacement: string; you_save: string | null; part_unavailable_note: string | null; surveyor_note: string | null; is_manual_override: boolean; target: { name: string } | null } | null
}

// B17 — property, surveyor, check-in time and GPS accuracy (flagged >50 m or outside the geofence) ·
// unit by unit, each fitting's 4 photos, flags and the three prices · "Create quotation".
export default async function SurveyDetailPage({ params }: PageProps<'/staff/surveys/[id]'>) {
  const user = await requireRole(['super_admin', 'cc_exec', 'surveyor'])
  const { id } = await params
  const supabase = await createClient()
  const { data: s } = await supabase.from('surveys')
    .select('id, status, scheduled_at, slot_end_at, submitted_at, surveyor_id, mode, reviewer_id, review_status, review_due_at, info_request, property:properties(name, address, lat, lng), surveyor:profiles!surveys_surveyor_id_fkey(full_name), lead:leads(id, name, phone)')
    .eq('id', id).maybeSingle()
  if (!s) notFound()
  const survey = s as unknown as { id: string; status: string; scheduled_at: string; slot_end_at: string; submitted_at: string | null; surveyor_id: string | null
    mode: string; reviewer_id: string | null; review_status: string | null; review_due_at: string | null; info_request: string | null
    property: { name: string; address: string; lat: number | null; lng: number | null } | null; surveyor: { full_name: string } | null; lead: { id: string; name: string | null; phone: string } | null }

  const [{ data: checkins }, { data: fits }, { data: quotes }] = await Promise.all([
    supabase.from('survey_checkins').select('id, checked_in_at, accuracy_m, geofence_ok, distance_m, flagged, flag_reason').eq('survey_id', id).order('checked_in_at'),
    supabase.from('fittings').select(`id, unit_label, model, notes, type:fitting_types(name), brand:brands(name), finish:finishes!fittings_current_finish_id_fkey(name),
      photos:fitting_photos(id, slot, storage_path), conditions:fitting_conditions(flag:condition_flags(name)),
      assessment:assessments(recommended, finish_id, price_recommended, price_replace_eurobrass, price_market_replacement, you_save, part_unavailable_note, surveyor_note, is_manual_override, target:finishes(name))`)
      .eq('survey_id', id).order('captured_at'),
    supabase.from('quotations').select('id, quote_no, version, status').eq('survey_id', id).order('created_at', { ascending: false }),
  ])
  // one assessment per fitting: PostgREST may return the embed as an object or a one-item array
  const fittings = ((fits ?? []) as unknown as (Omit<Fitting, 'assessment'> & { assessment: Fitting['assessment'] | NonNullable<Fitting['assessment']>[] })[])
    .map((f) => ({ ...f, assessment: Array.isArray(f.assessment) ? f.assessment[0] ?? null : f.assessment })) as Fitting[]
  const urls = await photoUrls(fittings.flatMap((f) => f.photos.map((p) => p.storage_path)), 'survey-photos', 480)
  const units = [...new Set(fittings.map((f) => f.unit_label ?? '—'))]
  const checkin = checkins?.[0]
  const isSelf = survey.mode !== 'onsite'
  const canQuote = survey.status === 'submitted' && (user.role === 'super_admin' || survey.surveyor_id === user.id || survey.reviewer_id === user.id)
  // BR-S10: the reviewer prices a submitted self-assessment until it is quoted
  const canPrice = isSelf && survey.status === 'submitted' && survey.review_status !== 'priced' && (user.role === 'super_admin' || survey.reviewer_id === user.id)
  const canAsk = isSelf && survey.status === 'submitted' && survey.review_status !== 'priced' && (user.role !== 'surveyor' || canPrice)
  const [{ data: finishes }, { data: reviewers }] = isSelf ? await Promise.all([
    supabase.from('finishes').select('id, name').eq('is_active', true).order('name'),
    user.role === 'super_admin' ? supabase.from('user_roles').select('user_id').eq('role', 'surveyor') : Promise.resolve({ data: [] as { user_id: string }[] }),
  ]) : [{ data: [] as { id: string; name: string }[] }, { data: [] as { user_id: string }[] }]
  const { data: reviewerProfiles } = reviewers?.length ? await supabase.from('profiles').select('id, full_name').in('id', reviewers.map((r) => r.user_id)).eq('is_active', true) : { data: [] }
  const overdue = isSelf && survey.review_status === 'awaiting' && !!survey.review_due_at && new Date(survey.review_due_at).getTime() < nowMs()
  const liveQuote = quotes?.find((q) => q.status !== 'superseded')

  return (
    <>
      <Link href="/staff/surveys" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-redux-blue hover:underline"><ArrowLeft className="size-4" aria-hidden /> Surveys</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-redux-blue">{isSelf ? (survey.mode === 'video' ? 'Self-assessment + video call' : 'Self-assessment') : 'Free survey'} · {survey.status === 'submitted' ? 'submitted' : survey.status.replace('_', ' ')}</p>
          <h1 className="mt-1 text-[28px] leading-tight font-semibold text-ink">{survey.property?.name}</h1>
          <p className="mt-1 text-sm text-muted-ink">{survey.property?.address} · {isSelf ? `Photographed by the customer · started ${formatWhen(survey.scheduled_at, false)}` : `Surveyor ${survey.surveyor?.full_name} · ${formatWhen(survey.scheduled_at)}`}</p>
        </div>
        {liveQuote ? (
          <Button variant="secondary" asChild><Link href={`/staff/quotes/${liveQuote.id}`}><FileText aria-hidden /> {liveQuote.quote_no} v{liveQuote.version}</Link></Button>
        ) : canQuote ? <CreateQuoteButton surveyId={id} /> : null}
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {isSelf ? (
          <Panel title="Review">
            <div className="space-y-2 text-sm">
              <p>{survey.review_status === 'priced' ? 'Quoted' : survey.review_status === 'awaiting' ? 'Submitted — waiting for review' : survey.review_status === 'needs_info' ? 'Sent back for more' : 'The customer is still adding fittings'}</p>
              {survey.review_status === 'awaiting' && survey.review_due_at && <p className={overdue ? 'font-semibold text-danger' : 'text-muted-ink'}>{overdue ? 'Overdue — was due ' : 'Report and proposal due '}{formatWhen(survey.review_due_at)}</p>}
              {survey.info_request && survey.review_status === 'needs_info' && <p className="rounded-md bg-warning-bg px-2.5 py-1.5 text-xs text-warning">Asked: {survey.info_request}</p>}
              {user.role === 'super_admin' && <div className="pt-1"><p className="mb-1 text-xs text-muted-ink">Reviewer</p><ReviewerSelect surveyId={id} current={survey.reviewer_id} people={reviewerProfiles ?? []} /></div>}
              {canAsk && <div className="pt-1"><AskForInfo surveyId={id} /></div>}
            </div>
          </Panel>
        ) : (
        <Panel title="Check-in">
          {checkin ? (
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2"><Crosshair className="size-4 text-redux-blue" aria-hidden /> {formatWhen(checkin.checked_in_at)}</p>
              <p>GPS accuracy <span className="num font-semibold">{Math.round(Number(checkin.accuracy_m ?? 0))} m</span>
                {checkin.geofence_ok !== null && <> · <span className="num">{Math.round(Number(checkin.distance_m ?? 0))} m</span> from the property</>}</p>
              {checkin.flagged
                ? <p className="flex items-start gap-1.5 rounded-md bg-warning-bg px-2.5 py-1.5 text-xs text-warning"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />{checkin.flag_reason} — recorded for review, work continued</p>
                : <StatusPill tone="positive">Inside the geofence</StatusPill>}
            </div>
          ) : <p className="text-sm text-muted-ink">Not checked in yet.</p>}
        </Panel>
        )}
        <Panel title="Audit"><p className="num text-[26px] font-semibold text-ink">{fittings.length}</p><p className="text-sm text-muted-ink">fittings across {units.length} {units.length === 1 ? 'unit' : 'units'} · {fittings.length * 4} photos</p></Panel>
        <Panel title="Customer">
          <p className="font-medium text-ink">{survey.lead?.name}</p>
          <p className="num text-sm text-muted-ink">{survey.lead?.phone}</p>
          {survey.lead && user.role !== 'surveyor' && <Link href={`/staff/leads/${survey.lead.id}`} className="mt-2 inline-block text-sm font-medium text-redux-blue hover:underline">Open lead →</Link>}
        </Panel>
      </div>

      {fittings.length === 0 && (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-line bg-white px-6 py-12 text-center">
          <IconCircle icon={Smartphone} size="lg" />
          <p className="mt-4 font-semibold text-ink">{isSelf ? 'Waiting for the customer' : survey.status === 'scheduled' ? `Waiting for the visit on ${formatWhen(survey.scheduled_at)}` : 'The surveyor is on site'}</p>
          <p className="mt-1 max-w-md text-sm text-muted-ink">
            {isSelf
              ? `The customer adds each fitting with four photos from their REDUX portal. The link went to them on WhatsApp; it stays open until ${formatWhen(survey.slot_end_at, false)}.`
              : `${survey.surveyor?.full_name ?? 'The surveyor'} records every fitting in the REDUX app — four photos, condition and the three prices. They appear here as soon as the phone syncs, even if the visit was offline.`}
          </p>
          {!isSelf && survey.property?.address && (
            <Button variant="outline" size="sm" className="mt-5" asChild>
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(survey.property.address)}`} target="_blank" rel="noreferrer"><MapPin aria-hidden /> Open address in Maps</a>
            </Button>
          )}
        </div>
      )}

      <div className="space-y-4">
        {units.map((u) => (
          <details key={u} open className="group rounded-lg border border-line bg-white shadow-card">
            <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4">
              <span className="font-semibold text-ink">{u.match(/^\d/) ? `Room ${u}` : u}</span>
              <span className="text-sm text-muted-ink">{fittings.filter((f) => (f.unit_label ?? '—') === u).length} fittings</span>
            </summary>
            <ul className="divide-y divide-line border-t border-line">
              {fittings.filter((f) => (f.unit_label ?? '—') === u).map((f) => (
                <li key={f.id} className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <IconCircle icon={Wrench} size="sm" />
                      <p className="font-semibold text-ink">{f.type?.name}</p>
                      <span className="text-sm text-muted-ink">{[f.brand?.name, f.model, f.finish?.name].filter(Boolean).join(' · ')}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {f.conditions.map((c, i) => <StatusPill key={i} tone="waiting">{c.flag?.name}</StatusPill>)}
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      {SLOTS.map((slot) => {
                        const p = f.photos.find((x) => x.slot === slot)
                        return (
                          <figure key={slot} className="relative overflow-hidden rounded-md border border-line bg-surface">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {p ? <img src={urls.get(p.storage_path)} alt={`${f.type?.name} — ${slot.replace('_', ' ')}`} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                               : <div className="flex aspect-[4/3] items-center justify-center text-xs text-danger">Missing</div>}
                            <figcaption className="eyebrow absolute bottom-1 left-1 rounded-sm bg-ink/75 px-1.5 py-0.5 text-[9px] text-white">{slot.replace('_', '-')}</figcaption>
                          </figure>
                        )
                      })}
                    </div>
                    {f.assessment?.surveyor_note && <p className="mt-3 text-sm text-muted-ink">“{f.assessment.surveyor_note}”</p>}
                  </div>
                  <div className="rounded-md bg-surface p-4">
                    {f.assessment ? (
                      <>
                        <p className="eyebrow text-muted-ink">Recommendation</p>
                        <p className="mt-1 font-semibold text-redux-blue">{TREATMENT[f.assessment.recommended]}{f.assessment.target ? ` → ${f.assessment.target.name}` : ''}</p>
                        <dl className="mt-3 space-y-1.5 text-sm">
                          <PriceRow label={TREATMENT[f.assessment.recommended]!} value={f.assessment.price_recommended} strong />
                          <PriceRow label="Eurobrass replacement" value={f.assessment.price_replace_eurobrass} />
                          <PriceRow label="Market replacement" value={f.assessment.price_market_replacement} />
                        </dl>
                        {f.assessment.you_save && <p className="mt-3 rounded-sm bg-redux-lime/70 px-2.5 py-1.5 text-sm font-semibold text-redux-blue">You save <Money value={f.assessment.you_save} paise="never" /></p>}
                        {f.assessment.part_unavailable_note && <p className="mt-2 text-xs text-ink">⚙ {f.assessment.part_unavailable_note}</p>}
                        {f.assessment.is_manual_override && <p className="mt-2 text-xs text-warning">Manual price — reason on the audit log</p>}
                        <p className="mt-3 text-[11px] text-faint">Available repairs and finishes depend on the condition of each fitting.</p>
                      </>
                    ) : user.role === 'cc_exec'
                      ? <p className="text-sm text-muted-ink">Prices appear on the quotation.</p>
                      : <p className="text-sm text-warning">{isSelf && survey.status !== 'submitted' ? 'Priced once the customer submits.' : 'Not assessed yet — every fitting needs a recommendation before quoting.'}</p>}
                    {canPrice && <PriceFitting surveyId={id} fittingId={f.id} finishes={finishes ?? []}
                      current={f.assessment ? { recommended: f.assessment.recommended, finish_id: f.assessment.finish_id, note: f.assessment.surveyor_note } : null} />}
                  </div>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </>
  )
}

function PriceRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className={strong ? 'font-medium text-ink' : 'text-muted-ink'}>{label}</dt>
      <dd className={strong ? 'font-semibold text-ink' : 'text-muted-ink'}><Money value={value} paise="never" /></dd>
    </div>
  )
}
