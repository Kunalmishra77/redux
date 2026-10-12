import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { nowMs } from '@/lib/services/clock'

// CR-001 phase 10 (E27, D33) — the lifecycle reports. Each tab is one database function; each table
// is one array inside its result. The page and the CSV export both read these definitions, so a
// downloaded file always matches the screen.

export type Col = { key: string; label: string; kind?: 'money' | 'num' | 'text' | 'date' }
export type Table = { key: string; title: string; columns: Col[]; note?: string }
export type ReportDef = { label: string; fn: string; since: boolean; tables: Table[]; facts?: { path: string; label: string; kind?: Col['kind'] }[] }

const money = (key: string, label: string): Col => ({ key, label, kind: 'money' })
const num = (key: string, label: string): Col => ({ key, label, kind: 'num' })
const text = (key: string, label: string): Col => ({ key, label })

export const REPORTS = {
  tiers: {
    label: 'Tiers & sources', fn: 'report_tiers', since: true,
    tables: [
      { key: 'by_tier', title: 'By tier', columns: [text('tier', 'Tier'), num('leads', 'Leads'), num('won', 'Won'), num('lost', 'Lost'), money('won_value', 'Won value')] },
      { key: 'by_segment', title: 'By segment', columns: [text('segment', 'Segment'), num('leads', 'Leads'), num('won', 'Won'), money('won_value', 'Won value')] },
      { key: 'by_source', title: 'By source (and referral)', note: 'A referral is counted beside the source, never instead of it.', columns: [text('source', 'Source'), num('leads', 'Leads'), num('referred', 'Referred'), num('won', 'Won'), money('won_value', 'Won value')] },
      { key: 'drift', title: 'Tier drift', note: 'Leads whose tier today differs from their first score.', columns: [text('lead', 'Lead'), text('first_tier', 'First tier'), text('tier_now', 'Tier now')] },
    ],
  },
  assessments: {
    label: 'Assessments', fn: 'report_assessments', since: true,
    facts: [
      { path: 'self_turnaround.median_hours', label: 'Self-assessment: median hours to proposal', kind: 'num' },
      { path: 'self_turnaround.within_sla', label: 'Within the 24-hour promise', kind: 'num' },
      { path: 'self_turnaround.late', label: 'Late', kind: 'num' },
      { path: 'self_turnaround.waiting', label: 'Waiting for review now', kind: 'num' },
    ],
    tables: [
      { key: 'by_mode', title: 'By assessment mode', columns: [text('mode', 'Mode'), num('assessments', 'Assessments'), num('completed', 'Completed'), num('quoted', 'Quoted'), num('won', 'Won'), money('won_value', 'Won value')] },
    ],
  },
  demos: {
    label: 'Demos', fn: 'report_demos', since: true,
    facts: [
      { path: 'funnel.proposed', label: 'Proposed', kind: 'num' }, { path: 'funnel.approved', label: 'Approved', kind: 'num' },
      { path: 'funnel.done', label: 'Done', kind: 'num' }, { path: 'funnel.converted', label: 'Converted', kind: 'num' },
      { path: 'cost_total', label: 'Spent on demos', kind: 'money' }, { path: 'cost_per_converted', label: 'Demo cost per order won', kind: 'money' },
      { path: 'converted_value', label: 'Orders after a demo', kind: 'money' },
    ],
    tables: [
      { key: 'by_type', title: 'By demo type', columns: [text('type', 'Type'), num('demos', 'Demos'), num('done', 'Done'), num('converted', 'Converted'), money('cost', 'Cost'), num('rating', 'Avg rating')] },
      { key: 'by_tier', title: 'By tier', columns: [text('tier', 'Tier'), num('demos', 'Demos'), num('converted', 'Converted')] },
    ],
  },
  people: {
    label: 'People', fn: 'report_people', since: true,
    tables: [
      { key: 'executives', title: 'Executives — enquiries they worked', columns: [text('person', 'Executive'), num('leads', 'Leads'), num('won', 'Won'), num('lost', 'Lost'), money('won_value', 'Won value')] },
      { key: 'surveyors', title: 'Surveyors and reviewers — assessments they did', columns: [text('person', 'Person'), num('assessments', 'Assessments'), num('completed', 'Completed'), num('won', 'Won'), money('won_value', 'Won value')] },
    ],
  },
  accounts: {
    label: 'Accounts & repeat', fn: 'report_accounts', since: false,
    facts: [
      { path: 'repeat.customers', label: 'Accounts with an order', kind: 'num' }, { path: 'repeat.repeat_customers', label: 'Ordered again', kind: 'num' },
      { path: 'repeat.repeat_value', label: 'Repeat order value', kind: 'money' }, { path: 'repeat.approved_value', label: 'All approved orders', kind: 'money' },
    ],
    tables: [
      { key: 'top_accounts', title: 'Top accounts', columns: [text('account', 'Account'), num('orders', 'Orders'), num('jobs_done', 'Jobs done'), money('approved_value', 'Ordered'), money('lifetime_billed', 'Billed'), money('lifetime_paid', 'Paid')] },
      { key: 'groups', title: 'Groups and chains', columns: [text('group_name', 'Group'), num('accounts', 'Accounts'), num('orders', 'Orders'), money('approved_value', 'Ordered'), money('billed', 'Billed')] },
    ],
  },
  referrals: {
    label: 'Referrals', fn: 'report_referrals', since: true,
    facts: [
      { path: 'totals.referrals', label: 'Referrals', kind: 'num' }, { path: 'totals.converted', label: 'Ordered', kind: 'num' },
      { path: 'totals.first_order_value', label: 'First-order value', kind: 'money' }, { path: 'totals.credit_issued', label: 'Credit issued', kind: 'money' },
      { path: 'totals.credit_redeemed', label: 'Credit used', kind: 'money' }, { path: 'totals.free_fittings', label: 'Free fittings earned', kind: 'num' },
    ],
    tables: [
      { key: 'top_referrers', title: 'Top referrers', columns: [text('referrer', 'Referrer'), num('referrals', 'Referrals'), num('converted', 'Ordered'), money('first_order_value', 'First-order value'), money('credit', 'Credit earned')] },
      { key: 'by_channel', title: 'How referrals arrive', columns: [text('channel', 'Channel'), num('referrals', 'Referrals'), num('converted', 'Ordered')] },
    ],
  },
  campaigns: {
    label: 'Campaigns', fn: 'report_campaigns', since: false,
    tables: [
      { key: 'campaigns', title: 'Campaigns', note: 'Cost uses the provider’s reported cost, else the assumed cost per WhatsApp marketing message (settings).',
        columns: [text('campaign', 'Campaign'), text('channel', 'Channel'), num('sent', 'Sent'), num('skipped', 'Skipped'), num('delivered', 'Delivered'), num('read', 'Read'),
          num('replied', 'Replied'), num('reactivated', 'Reactivated'), num('opted_out', 'Opted out'), money('cost', 'Cost'), money('revenue', 'Orders after')] },
    ],
  },
  products: {
    label: 'Products', fn: 'report_products', since: true,
    tables: [
      { key: 'products', title: 'What customers order', note: 'By fitting type and work until the product catalog (phase 7) is loaded.', columns: [text('fitting', 'Fitting'), text('work', 'Work'), num('lines', 'Lines'), num('qty', 'Qty'), money('value', 'Value')] },
    ],
  },
} satisfies Record<string, ReportDef>

export type ReportKind = keyof typeof REPORTS
export const isReportKind = (k: unknown): k is ReportKind => typeof k === 'string' && k in REPORTS
export const rangeDays = (d: unknown) => ([30, 90, 365].includes(Number(d)) ? Number(d) : 90)

export async function loadReport(kind: ReportKind, days: number): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  const def: ReportDef = REPORTS[kind]
  const supabase = await createClient()
  const args = def.since ? { p_since: new Date(nowMs() - days * 86_400_000).toISOString() } : {}
  const { data, error } = await supabase.rpc(def.fn as 'report_tiers', args as { p_since: string })
  return { data: (data ?? null) as Record<string, unknown> | null, error: error?.message ?? null }
}

export const pick = (obj: unknown, path: string): unknown => path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj)
