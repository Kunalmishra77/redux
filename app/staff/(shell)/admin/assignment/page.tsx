import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, MapPin, Repeat } from 'lucide-react'
import { PageHeader, Panel } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Cities & assignment' }

// B30 — BR-L3: a new lead goes round-robin to the active care executives of its city; a city with
// nobody falls back to everyone. Change who covers a city from Users & roles.
export default async function AssignmentPage() {
  await requireRole(['super_admin'])
  const supabase = await createClient()
  const [{ data: cities }, { data: people }, { data: roles }, { data: state }, { data: leads }] = await Promise.all([
    supabase.from('cities').select('id, name, state_code, is_active').order('name'),
    supabase.from('profiles').select('id, full_name, city_id, is_active'),
    supabase.from('user_roles').select('user_id, role'),
    supabase.from('assignment_state').select('scope, last_user_id, updated_at'),
    supabase.from('leads').select('city_id, assigned_to, status').not('status', 'in', '(won,lost)'),
  ])
  const roleOf = (id: string) => roles?.find((r) => r.user_id === id)?.role
  const active = (people ?? []).filter((p) => p.is_active)
  const execs = active.filter((p) => roleOf(p.id) === 'cc_exec')
  const surveyors = active.filter((p) => roleOf(p.id) === 'surveyor')
  const name = (id: string | null | undefined) => people?.find((p) => p.id === id)?.full_name
  return (
    <>
      <PageHeader back={{ href: '/staff/admin', label: 'Admin' }} title="Cities & assignment" description="New leads rotate among the care executives who cover the lead’s city. Nobody in a city? Everyone shares it."
        actions={<Link href="/staff/admin/users" className="inline-flex items-center gap-1 text-sm font-semibold text-redux-blue hover:underline">Change who covers a city <ArrowRight className="size-4" aria-hidden /></Link>} />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {(cities ?? []).map((c) => {
          const cityExecs = execs.filter((p) => p.city_id === c.id)
          const citySurveyors = surveyors.filter((p) => p.city_id === c.id)
          const st = state?.find((s) => s.scope === `city:${c.id}`)
          const open = (leads ?? []).filter((l) => l.city_id === c.id)
          return (
            <Panel key={c.id} title={<span className="inline-flex items-center gap-2"><MapPin className="size-4 text-redux-blue" aria-hidden />{c.name}</span>}
              action={<span className="num text-xs text-muted-ink">GST state {c.state_code}</span>}>
              <dl className="space-y-3 text-sm">
                <div><dt className="eyebrow text-muted-ink">Care executives</dt>
                  <dd className="mt-1">{cityExecs.length ? cityExecs.map((p) => {
                    const n = open.filter((l) => l.assigned_to === p.id).length
                    return <p key={p.id} className="flex justify-between"><span className="text-ink">{p.full_name}{st?.last_user_id === p.id && <span className="ml-1.5 text-xs text-muted-ink">(last assigned)</span>}</span><span className="num text-muted-ink">{n} open</span></p>
                  }) : <p className="text-warning">Nobody — leads here rotate across all care executives</p>}</dd></div>
                <div><dt className="eyebrow text-muted-ink">Surveyors based here</dt>
                  <dd className="mt-1 text-ink">{citySurveyors.map((p) => p.full_name).join(', ') || <span className="text-muted-ink">None — surveyors from nearby cities are offered</span>}</dd></div>
                <div className="flex items-center justify-between border-t border-line pt-3 text-xs text-muted-ink">
                  <span className="inline-flex items-center gap-1"><Repeat className="size-3.5" aria-hidden /> Next lead goes to {cityExecs.length ? (name(cityExecs.map((p) => p.id).sort().find((id) => !st?.last_user_id || id > st.last_user_id) ?? cityExecs.map((p) => p.id).sort()[0])) : 'the shared rotation'}</span>
                  <span className="num">{open.length} open</span>
                </div>
              </dl>
            </Panel>
          )
        })}
      </div>
    </>
  )
}
