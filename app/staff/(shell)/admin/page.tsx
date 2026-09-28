import type { Metadata } from 'next'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
  BadgePercent, Banknote, BarChart3, Bell, Boxes, FileClock, IndianRupee, ListTree, MapPinned, PlugZap, Receipt,
  ShieldCheck, SlidersHorizontal, Users,
} from 'lucide-react'
import { IconCircle, PageHeader } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Admin' }

type Tile = { href: string; title: string; body: string; icon: LucideIcon; badge?: number }

// Admin hub — every Super Admin setting in one place (D17).
export default async function AdminHub() {
  await requireRole(['super_admin'])
  const supabase = await createClient()
  const [{ count: discounts }, { count: dsr }, { count: deadHooks }, { count: low }] = await Promise.all([
    supabase.from('discount_approvals').select('id', { count: 'exact', head: true }).is('decision', null),
    supabase.from('dsr_requests').select('id', { count: 'exact', head: true }).in('status', ['received', 'in_progress']),
    supabase.from('webhook_events').select('id', { count: 'exact', head: true }).in('status', ['failed', 'dead']),
    supabase.from('v_low_stock').select('id', { count: 'exact', head: true }),
  ])
  const sections: { title: string; tiles: Tile[] }[] = [
    { title: 'Money', tiles: [
      { href: '/staff/admin/discounts', title: 'Discount approvals', body: 'Quotes waiting on a discount above the threshold', icon: BadgePercent, badge: discounts ?? 0 },
      { href: '/staff/admin/invoices', title: 'Invoices', body: 'GST tax invoices and credit notes', icon: Receipt },
      { href: '/staff/admin/payments', title: 'Payments', body: 'Razorpay payments and reconciliation', icon: Banknote },
      { href: '/staff/admin/rate-card', title: 'Rate card', body: 'Versioned prices — old quotes never re-price', icon: IndianRupee },
    ] },
    { title: 'Operations', tiles: [
      { href: '/staff/admin/stock', title: 'Stock & parts', body: 'Cartridges, spares, replacements', icon: Boxes, badge: low ?? 0 },
      { href: '/staff/admin/reports', title: 'Reports', body: 'Funnel, sources, teams, revenue', icon: BarChart3 },
      { href: '/staff/admin/users', title: 'Users & roles', body: 'Care executives, surveyors, admins', icon: Users },
      { href: '/staff/admin/assignment', title: 'Cities & assignment', body: 'Who gets new leads, city by city', icon: MapPinned },
    ] },
    { title: 'Configuration', tiles: [
      { href: '/staff/admin/masters', title: 'Master lists', body: 'Fitting types, brands, finishes, reasons', icon: ListTree },
      { href: '/staff/admin/notifications', title: 'Notifications', body: 'WhatsApp templates and the rules that send them', icon: Bell },
      { href: '/staff/admin/integrations', title: 'Integrations', body: 'Meta, WhatsApp, Google Ads, Razorpay health', icon: PlugZap, badge: deadHooks ?? 0 },
      { href: '/staff/admin/settings', title: 'Settings', body: 'Thresholds, SLAs, warranty terms, GST identity', icon: SlidersHorizontal },
    ] },
    { title: 'Trust', tiles: [
      { href: '/staff/admin/privacy', title: 'Privacy (DPDP)', body: 'Consent ledger and data requests', icon: ShieldCheck, badge: dsr ?? 0 },
      { href: '/staff/admin/audit', title: 'Audit log', body: 'Every privileged change, who and when', icon: FileClock },
    ] },
  ]
  return (
    <>
      <PageHeader title="Admin" description="Settings, money and the records that keep REDUX accountable." />
      <div className="space-y-8">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="eyebrow mb-3 text-muted-ink">{s.title}</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {s.tiles.map((t) => (
                <Link key={t.href} href={t.href} className="group relative flex gap-4 rounded-lg border border-line bg-white p-5 shadow-card transition hover:border-redux-blue/40">
                  <IconCircle icon={t.icon} />
                  <div className="min-w-0">
                    <p className="font-semibold text-ink group-hover:text-redux-blue">{t.title}</p>
                    <p className="mt-0.5 text-sm text-muted-ink">{t.body}</p>
                  </div>
                  {!!t.badge && <span className="num absolute top-3 right-3 rounded-full bg-danger px-2 py-0.5 text-[11px] font-semibold text-white">{t.badge}</span>}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}
