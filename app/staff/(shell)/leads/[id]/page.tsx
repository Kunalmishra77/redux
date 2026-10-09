import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ShieldCheck, ShieldX } from 'lucide-react'
import { formatWhen, LEAD_STATUS, Money, Panel, StatusPill, Timeline } from '@/components/patterns'
import { SourceBadge, SlaTimer } from '@/components/features/leads/bits'
import { LeadWorkPane } from '@/components/features/leads/work-pane'
import { DecisionControls } from '@/components/features/leads/decision-panel'
import { BAND_LABEL, DEMO_LABEL, MODE_LABEL } from '@/lib/constants/assessment'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { LEAD_COLUMNS, loadLeadTimeline, loadPickLists, toWorkLead, type LeadRow } from '@/lib/data/leads'

export const metadata: Metadata = { title: 'Lead' }

const PURPOSE: Record<string, string> = { service: 'Service contact', marketing: 'Marketing', call_recording: 'Call recording', photo_marketing: 'Photos in marketing' }

// B7 — left: identity, source (read-only — attribution is immutable, BR-L3), consent, assignment ·
// centre: the timeline · right: the actions.
export default async function LeadDetailPage({ params }: PageProps<'/staff/leads/[id]'>) {
  const user = await requireRole(['super_admin', 'cc_exec', 'surveyor'])
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('leads')
    .select(`${LEAD_COLUMNS}, email, utm, ctwa_clid, meta_ad_id, meta_form_id, google_lead_id, lost_note,
             campaign:campaigns(name), lost_reason:lost_reasons(name), previous_lead_id, customer_id, assigned_to, score, tier, tier_override, tier_override_reason, distance_band, distance_km, scored_at, assessment_mode, demo_offer, assessment_override_reason, estimated_value, account:customers!leads_customer_id_fkey(name, is_prospect, tier, next_action, next_action_at)`)
    .eq('id', id).maybeSingle()
  if (!data) notFound()
  const lead = data as unknown as LeadRow & {
    email: string | null; utm: Record<string, string> | null; ctwa_clid: string | null; meta_ad_id: string | null
    meta_form_id: string | null; google_lead_id: string | null; lost_note: string | null; campaign: { name: string } | null
    lost_reason: { name: string } | null; previous_lead_id: string | null
    customer_id: string | null; assigned_to: string | null; score: number | null; tier: string | null; tier_override: string | null; tier_override_reason: string | null
    distance_band: string | null; distance_km: number | null; scored_at: string | null; assessment_mode: string | null; demo_offer: string | null
    assessment_override_reason: string | null; estimated_value: number | null; account: { name: string; is_prospect: boolean; tier: string | null; next_action: string | null; next_action_at: string | null } | null
  }

  const [lists, timeline, consents, openSurvey, lastScore, selfSurvey, summary] = await Promise.all([
    loadPickLists(),
    loadLeadTimeline(id),
    supabase.from('consent_records').select('id, purpose, granted, withdrawn_at, notice_version, method, granted_at').eq('lead_id', id).order('granted_at'),
    supabase.from('surveys').select('id').eq('lead_id', id).neq('status', 'cancelled').limit(1),
    supabase.from('lead_scores').select('breakdown, rules_version, created_at').eq('lead_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('surveys').select('id, status, review_status').eq('lead_id', id).neq('mode', 'onsite').neq('status', 'cancelled').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    lead.customer_id ? supabase.from('v_account_summary').select('lifetime_billed, open_proposal_value, jobs_done, last_work_on').eq('customer_id', lead.customer_id).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const acct = summary.data
  const breakdown = (lastScore.data?.breakdown ?? []) as { label: string; points: number }[]
  const canWork = user.role === 'super_admin' || (user.role === 'cc_exec' && lead.assigned_to === user.id)
  const st = LEAD_STATUS[lead.status]
  // latest record per purpose wins (BR-P2)
  const consent = new Map<string, NonNullable<typeof consents.data>[number]>()
  for (const c of consents.data ?? []) consent.set(c.purpose, c)

  return (
    <>
      <Link href="/staff/leads" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-redux-blue hover:underline"><ArrowLeft className="size-4" aria-hidden /> All leads</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-tight font-semibold text-ink">{lead.property_name ?? lead.name}</h1>
          <p className="mt-1 text-sm text-muted-ink">{lead.name}{lead.enquirer_role ? ` · ${lead.enquirer_role}` : ''} · <span className="num">{lead.phone}</span>{lead.email ? ` · ${lead.email}` : ''}</p>
          {lead.customer_id && lead.account && (
            <Link href={`/staff/accounts/${lead.customer_id}`} className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-redux-blue hover:underline">Account: {lead.account.name}{lead.account.is_prospect ? ' (prospect)' : ''} →</Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          {st && <StatusPill tone={st.tone}>{st.label}</StatusPill>}
          <SlaTimer due={lead.sla_due_at} done={lead.status !== 'new'} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)_24rem]">
        <div className="space-y-5">
          {lead.customer_id && lead.account && (
            <Panel title="Account" action={<Link href={`/staff/accounts/${lead.customer_id}`} className="text-xs font-medium text-redux-blue hover:underline">Open 360° →</Link>}>
              <dl className="space-y-3 text-sm">
                <Row label="Account">{lead.account.name}{lead.account.tier && <span className="num ml-1.5 rounded-sm bg-pale px-1.5 text-xs font-bold text-redux-blue">{lead.account.tier}</span>}</Row>
                <Row label="Stage">{lead.account.is_prospect ? 'Prospect' : 'Customer'}</Row>
                <Row label="Billed so far"><Money value={Number(acct?.lifetime_billed ?? 0).toFixed(0)} paise="never" /></Row>
                {Number(acct?.open_proposal_value ?? 0) > 0 && <Row label="Open proposals"><Money value={Number(acct?.open_proposal_value).toFixed(0)} paise="never" /></Row>}
                <Row label="Last work">{acct?.last_work_on ? formatWhen(acct.last_work_on, false) : '—'}</Row>
                {lead.account.next_action && <Row label="Next action">{lead.account.next_action}{lead.account.next_action_at ? ` · ${formatWhen(lead.account.next_action_at, false)}` : ''}</Row>}
              </dl>
            </Panel>
          )}
          {lead.tier && (
            <Panel title="Qualification" action={lead.scored_at ? <span className="text-[11px] text-faint">scored {formatWhen(lead.scored_at, false)}</span> : null}>
              <div className="flex items-center gap-3">
                <span className={`num flex size-12 items-center justify-center rounded-lg text-2xl font-bold ${lead.tier === 'A' ? 'bg-redux-blue text-white' : lead.tier === 'B' ? 'bg-pale text-redux-blue' : 'bg-surface text-muted-ink'}`}>{lead.tier}</span>
                <div className="text-sm">
                  <p className="font-semibold text-ink">Tier {lead.tier} · <span className="num">{lead.score ?? 0}</span> points</p>
                  {lead.tier_override && <p className="text-xs text-warning">Overridden — {lead.tier_override_reason}</p>}
                </div>
              </div>
              {breakdown.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs">
                  {breakdown.map((b, i) => <li key={i} className="flex justify-between gap-2"><span className="text-muted-ink">{b.label}</span><span className="num font-medium text-ink">+{b.points}</span></li>)}
                </ul>
              )}
              <dl className="mt-3 space-y-2 border-t border-line pt-3 text-sm">
                <Row label="Location">{BAND_LABEL[lead.distance_band ?? 'unknown']}{lead.distance_km !== null ? <span className="num text-muted-ink"> · {Math.round(Number(lead.distance_km))} km</span> : null}</Row>
                <Row label="Assessment">{MODE_LABEL[lead.assessment_mode ?? ''] ?? '—'}</Row>
                <Row label="Demo">{DEMO_LABEL[lead.demo_offer ?? ''] ?? '—'}</Row>
                {selfSurvey.data && <Row label="Self-assessment">{selfSurvey.data.status === 'submitted' ? (selfSurvey.data.review_status === 'priced' ? 'quoted' : 'submitted — to review') : selfSurvey.data.review_status === 'needs_info' ? 'more info asked' : 'with the customer'}</Row>}
              </dl>
              {lead.assessment_override_reason && <p className="mt-2 text-xs text-warning">Changed by the team — {lead.assessment_override_reason}</p>}
              <DecisionControls leadId={id} isAdmin={user.role === 'super_admin'} tier={lead.tier} tierOverridden={!!lead.tier_override}
                mode={lead.assessment_mode} demoOffer={lead.demo_offer} modeOverridden={!!lead.assessment_override_reason}
                selfSurveyId={selfSurvey.data?.id ?? null} canWork={canWork} />
            </Panel>
          )}
          <Panel title="Enquiry">
            <dl className="space-y-3 text-sm">
              <Row label="Type">{lead.customer_type === 'hotel' ? 'Hotel' : lead.customer_type === 'home' ? 'Home' : lead.customer_type === 'dealer' ? 'Dealer' : '—'}</Row>
              <Row label={lead.customer_type === 'hotel' ? 'Rooms' : 'Bathrooms'}><span className="num">{lead.unit_count ?? '—'}</span></Row>
              <Row label="City">{lead.city?.name ?? '—'}</Row>
              <Row label="Executive">{lead.owner?.full_name ?? 'Unassigned'}</Row>
              <Row label="Received">{formatWhen(lead.created_at)}</Row>
              {lead.lost_reason && <Row label="Lost because">{lead.lost_reason.name}{lead.lost_note ? ` — ${lead.lost_note}` : ''}</Row>}
              {lead.previous_lead_id && <Row label="Returning"><Link href={`/staff/leads/${lead.previous_lead_id}`} className="text-redux-blue hover:underline">Earlier lead →</Link></Row>}
            </dl>
          </Panel>
          <Panel title="Attribution" action={<span className="text-[11px] text-faint">Locked to the first touch</span>}>
            <dl className="space-y-3 text-sm">
              <Row label="Source"><SourceBadge code={lead.source?.code ?? ''} /></Row>
              {lead.campaign && <Row label="Campaign">{lead.campaign.name}</Row>}
              {lead.meta_ad_id && <Row label="Meta ad"><span className="num text-xs">{lead.meta_ad_id}</span></Row>}
              {lead.ctwa_clid && <Row label="CTWA click"><span className="num break-all text-xs">{lead.ctwa_clid}</span></Row>}
              {lead.google_lead_id && <Row label="Google lead"><span className="num text-xs">{lead.google_lead_id}</span></Row>}
              {lead.utm && Object.entries(lead.utm).map(([k, v]) => <Row key={k} label={k}>{v}</Row>)}
            </dl>
          </Panel>
          <Panel title="Consent" action={<span className="text-[11px] text-faint">DPDP</span>}>
            {consent.size === 0 ? <p className="text-sm text-muted-ink">No consent on record yet.</p> : (
              <ul className="space-y-2.5 text-sm">
                {[...consent.values()].map((c) => {
                  const live = c.granted && !c.withdrawn_at
                  return (
                    <li key={c.id} className="flex items-start gap-2">
                      {live ? <ShieldCheck className="mt-0.5 size-4 text-success" aria-hidden /> : <ShieldX className="mt-0.5 size-4 text-faint" aria-hidden />}
                      <span>
                        <span className="font-medium text-ink">{PURPOSE[c.purpose]}</span> — {live ? 'yes' : c.withdrawn_at ? 'withdrawn' : 'no'}
                        <span className="block text-xs text-faint">Notice {c.notice_version} · {c.method.replace('_', ' ')} · {formatWhen(c.granted_at, false)}</span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>
        </div>

        <Panel title="Activity">
          {timeline.length ? <Timeline items={timeline} /> : <p className="text-sm text-muted-ink">Nothing yet.</p>}
        </Panel>

        <LeadWorkPane lead={toWorkLead(lead, (openSurvey.data?.length ?? 0) > 0)} {...lists} />
      </div>
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-muted-ink">{label}</dt>
      <dd className="text-right text-ink">{children}</dd>
    </div>
  )
}
