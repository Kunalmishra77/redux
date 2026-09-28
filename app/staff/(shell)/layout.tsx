import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { Sidebar } from '@/components/shell/sidebar'
import { Topbar, type Alert } from '@/components/shell/topbar'
import { ROLE_LABEL } from '@/components/shell/nav'
import { DemoBar } from '@/components/demo/demo-bar'
import { requireRole, STAFF_ROLES } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

const ENTITY_HREF: Record<string, (id: string) => string> = {
  leads: (id) => `/staff/leads/${id}`,
  surveys: (id) => `/staff/surveys/${id}`,
  quotations: (id) => `/staff/quotes/${id}`,
  discount_approvals: () => '/staff/admin/discounts',
  service_requests: () => '/staff/service-requests',
  stock_items: () => '/staff/admin/stock',
  job_units: () => '/staff/jobs',
  integration_accounts: () => '/staff/admin/integrations',
  webhook_events: () => '/staff/admin/integrations',
}

export default async function StaffShell({ children }: LayoutProps<'/staff'>) {
  const user = await requireRole(STAFF_ROLES)
  const role = user.role as Exclude<typeof user.role, 'customer'>
  const supabase = await createClient()
  const { data: rows } = await supabase
    .from('team_notifications')
    .select('id, title, body, entity_type, entity_id, created_at, read_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)
  const alerts: Alert[] = (rows ?? []).map((r) => ({
    id: r.id, title: r.title, body: r.body, at: r.created_at, read: !!r.read_at,
    href: r.entity_type && r.entity_id ? ENTITY_HREF[r.entity_type]?.(r.entity_id) ?? null : null,
  }))

  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-redux-blue py-5 md:flex">
        <Link href="/staff" className="mb-8 px-6"><Logo tone="white" /></Link>
        <Sidebar role={role} />
        <div className="mt-auto px-6 text-[11px] text-pale">
          <p className="font-semibold text-white">REDUX workspace</p>
          <p>{ROLE_LABEL[user.role]} view</p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <DemoBar />
        <Topbar name={user.name} roleLabel={ROLE_LABEL[user.role]} alerts={alerts} searchable={role !== 'surveyor'} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  )
}
