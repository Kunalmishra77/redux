import type { Metadata } from 'next'
import { CalendarCheck, FileText, Hammer, Users } from 'lucide-react'
import { Kpi, PageHeader } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const user = await requireRole(['super_admin'])
  const supabase = await createClient()
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const [leads, surveys, quotes, jobs] = await Promise.all([
    supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
    supabase.from('surveys').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
    supabase.from('quotations').select('id', { count: 'exact', head: true }).eq('status', 'sent'),
    supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('current_stage', 'at_eurobrass'),
  ])
  return (
    <>
      <PageHeader eyebrow="Super Admin" title={`Good to see you, ${user.name.split(' ')[0]}`} description="The whole operation, from one screen." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Leads this month" value={leads.count ?? 0} icon={Users} />
        <Kpi label="Free surveys done" value={surveys.count ?? 0} icon={CalendarCheck} />
        <Kpi label="Quotes out" value={quotes.count ?? 0} icon={FileText} />
        <Kpi label="Jobs at Eurobrass" value={jobs.count ?? 0} icon={Hammer} />
      </div>
    </>
  )
}
