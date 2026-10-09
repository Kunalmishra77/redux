import type { Metadata } from 'next'
import { PageHeader, Panel } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { DEMO_LABEL, MODE_LABEL } from '@/lib/constants/assessment'
import { PolicyCell, RescoreAllButton, RuleRow, ScorePreview, ServiceAreaRow, Thresholds } from './scoring-controls'

export const metadata: Metadata = { title: 'Lead scoring' }

const BAND = { near: 'Inside service area', far: 'Outside', unknown: 'Location unknown' } as const

/** Shows a rule's stored value the way the admin types it. */
function valueText(op: string, v: unknown) {
  if (op === 'is_true') return ''
  if (op === 'between' && Array.isArray(v)) return `${v[0]}-${v[1]}`
  if (Array.isArray(v)) return v.join(', ')
  return String(v ?? '')
}

// E21 (D27) — ADR-018: the scoring rules, tier thresholds, service area and the policy matrix are
// data the Super Admin edits here; every lead is scored by the same SQL function.
export default async function ScoringAdminPage() {
  await requireRole(['super_admin'])
  const supabase = await createClient()
  const [{ data: rules }, { data: thr }, { data: ver }, { data: policies }, { data: areas }, { data: segments }, { data: dist }] = await Promise.all([
    supabase.from('scoring_rules').select('id, factor, operator, value, points, label, is_active').order('sort_order').order('label'),
    supabase.from('settings').select('value').eq('key', 'tier_thresholds').maybeSingle(),
    supabase.from('settings').select('value').eq('key', 'scoring_rules_version').maybeSingle(),
    supabase.from('assessment_policies').select('tier, distance_band, mode, demo_offer, owner_role, followup_days, note'),
    supabase.from('service_areas').select('id, name, near_km, is_active').order('name'),
    supabase.from('segments').select('code, name').eq('is_active', true).order('sort_order'),
    supabase.from('leads').select('tier').not('status', 'in', '(won,lost)'),
  ])
  const t = (thr?.value ?? { A: 40, B: 15 }) as { A: number; B: number }
  const counts = { A: 0, B: 0, C: 0 } as Record<string, number>
  for (const l of dist ?? []) if (l.tier) counts[l.tier] = (counts[l.tier] ?? 0) + 1

  return (
    <>
      <PageHeader back={{ href: '/staff/admin', label: 'Admin' }} title="Lead scoring"
        description="Points decide the tier; tier and distance decide the assessment and the demo offer. Changes apply to every open lead when you rescore."
        actions={<RescoreAllButton />} />

      <div className="mb-6 grid grid-cols-3 gap-3 sm:max-w-md">
        {(['A', 'B', 'C'] as const).map((k) => (
          <div key={k} className="rounded-lg border border-line bg-white p-3 text-center shadow-card">
            <p className="eyebrow text-muted-ink">Tier {k}</p><p className="num mt-1 text-xl font-semibold text-ink">{counts[k]}</p><p className="text-[11px] text-faint">open leads</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <Panel title="Rules" action={<span className="num text-[11px] text-faint">version {String(ver?.value ?? 1)}</span>}>
            <table className="w-full min-w-[40rem] text-sm">
              <thead><tr className="border-b border-line text-left text-xs text-muted-ink">{['Rule', 'Reads', 'When', 'Value', 'Points', 'On', ''].map((h) => <th key={h} className="px-2 py-2 font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {(rules ?? []).map((r) => <RuleRow key={r.id} rule={{ id: r.id, factor: r.factor, operator: r.operator, value: valueText(r.operator, r.value), points: r.points, label: r.label, is_active: r.is_active }} />)}
                <RuleRow rule={null} />
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted-ink">Values: a number (40), a range (10-39), or a list (hotel, hospital). Rooms come from the enquiry or the account size; value is the estimated order in rupees.</p>
          </Panel>

          <Panel title="Who gets which assessment">
            <table className="w-full min-w-[40rem] text-sm">
              <thead><tr className="border-b border-line text-left text-xs text-muted-ink"><th className="px-2 py-2 font-semibold">Tier</th>{Object.values(BAND).map((b) => <th key={b} className="px-2 py-2 font-semibold">{b}</th>)}</tr></thead>
              <tbody>
                {(['A', 'B', 'C'] as const).map((tier) => (
                  <tr key={tier} className="border-b border-line align-top last:border-0">
                    <td className="num px-2 py-3 font-bold text-redux-blue">{tier}</td>
                    {(Object.keys(BAND) as (keyof typeof BAND)[]).map((band) => {
                      const p = policies?.find((x) => x.tier === tier && x.distance_band === band)
                      return <td key={band} className="px-2 py-3">{p ? <PolicyCell policy={p} modeLabel={MODE_LABEL[p.mode]} demoLabel={DEMO_LABEL[p.demo_offer]} /> : '—'}</td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>

        <div className="min-w-0 space-y-5">
          <Panel title="Tier thresholds"><Thresholds a={t.A} b={t.B} /></Panel>
          <Panel title="Service area">
            <ul className="space-y-3">{(areas ?? []).map((a) => <ServiceAreaRow key={a.id} area={{ id: a.id, name: a.name, near_km: Number(a.near_km), is_active: a.is_active }} />)}</ul>
            <p className="mt-2 text-xs text-muted-ink">On-site surveys only inside this radius; the rest get a self-assessment unless the policy says otherwise.</p>
          </Panel>
          <Panel title="Test a lead"><ScorePreview segments={segments ?? []} /></Panel>
        </div>
      </div>
    </>
  )
}
