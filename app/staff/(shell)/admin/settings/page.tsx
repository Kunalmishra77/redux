import type { Metadata } from 'next'
import { PageHeader, Panel } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { SettingField } from './setting-field'

export const metadata: Metadata = { title: 'Settings' }

// Groups for the settings REDUX tunes. Everything else in `settings` is shown read-only below.
const GROUPS: { title: string; keys: { key: string; label: string; unit?: string }[] }[] = [
  { title: 'Sales', keys: [
    { key: 'sla_callback_minutes', label: 'Call back a new lead within', unit: 'minutes' },
    { key: 'discount_threshold_pct', label: 'Discounts above this need approval', unit: '%' },
    { key: 'quote_validity_days', label: 'A sent quotation stays approvable for', unit: 'days' },
  ] },
  { title: 'Field', keys: [
    { key: 'geofence_radius_m', label: 'Flag a check-in further than', unit: 'metres' },
    { key: 'gps_accuracy_flag_m', label: 'Flag GPS accuracy worse than', unit: 'metres' },
    { key: 'survey_visit_cost_inr', label: 'Cost of one free survey visit (for reports)', unit: '₹' },
  ] },
  { title: 'Money & privacy', keys: [
    { key: 'payment_link_max', label: 'Invoices above this go to a bank account', unit: '₹' },
    { key: 'invoice_warn_days', label: 'Warn when a finished job is not invoiced after', unit: 'days' },
    { key: 'recording_retention_days', label: 'Delete call recordings after', unit: 'days' },
  ] },
]

// Settings — every threshold is data, never code (CLAUDE.md). Each change is audited.
export default async function SettingsPage() {
  await requireRole(['super_admin'])
  const supabase = await createClient()
  const { data } = await supabase.from('settings').select('key, value, description, updated_at').order('key')
  const all = data ?? []
  const edited = new Set(GROUPS.flatMap((g) => g.keys.map((k) => k.key)))
  const identity = ['supplier_legal_name', 'supplier_gstin', 'supplier_address', 'supplier_state_code', 'invoice_series_code']
  const warranty = all.find((s) => s.key === 'warranty_terms')?.value as Record<string, unknown> | undefined
  return (
    <>
      <PageHeader eyebrow="Admin" title="Settings" description="Thresholds and terms the system runs on. Changes apply to new work; issued quotes and invoices keep what they were issued with." />
      <div className="grid gap-5 xl:grid-cols-3">
        {GROUPS.map((g) => (
          <Panel key={g.title} title={g.title}>
            <div className="space-y-4">
              {g.keys.map((k) => {
                const s = all.find((x) => x.key === k.key)
                return s ? <SettingField key={k.key} settingKey={k.key} label={k.label} unit={k.unit} value={String(s.value ?? '')} hint={s.description} /> : null
              })}
            </div>
          </Panel>
        ))}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel title="GST identity (on every invoice)">
          <dl className="space-y-2 text-sm">
            {identity.map((k) => <div key={k} className="flex justify-between gap-4"><dt className="text-muted-ink">{k.replace('supplier_', '').replace(/_/g, ' ')}</dt><dd className="num text-right text-ink">{String(all.find((s) => s.key === k)?.value ?? '—')}</dd></div>)}
          </dl>
          <p className="mt-3 text-xs text-muted-ink">Fixed onto each invoice at issue. Changes here never alter an issued invoice.</p>
        </Panel>
        <Panel title="Warranty terms (snapshotted onto each quote)">
          {warranty ? <dl className="space-y-2 text-sm">{Object.entries(warranty).map(([k, v]) => <div key={k} className="flex justify-between gap-4"><dt className="text-muted-ink">{k.replace(/_/g, ' ')}</dt><dd className="text-right text-ink">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd></div>)}</dl>
            : <p className="text-sm text-muted-ink">Not loaded yet.</p>}
        </Panel>
      </div>
      <Panel title="Everything else" className="mt-5">
        <dl className="grid gap-x-8 gap-y-2 text-sm md:grid-cols-2">
          {all.filter((s) => !edited.has(s.key) && !identity.includes(s.key) && s.key !== 'warranty_terms').map((s) => (
            <div key={s.key} className="flex justify-between gap-4 border-b border-line py-1.5"><dt className="num text-xs text-muted-ink">{s.key}</dt><dd className="max-w-[60%] truncate text-right text-xs text-ink">{typeof s.value === 'object' ? JSON.stringify(s.value) : String(s.value)}</dd></div>
          ))}
        </dl>
      </Panel>
    </>
  )
}
