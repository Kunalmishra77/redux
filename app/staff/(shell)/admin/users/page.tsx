import type { Metadata } from 'next'
import { PageHeader } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { ROLE_LABEL } from '@/components/shell/nav'
import { AddStaffButton, StaffActive, StaffCity } from './user-controls'

export const metadata: Metadata = { title: 'Users & roles' }

// B29 — staff logins, their role and city. Deactivating keeps every record they touched.
export default async function UsersPage() {
  const me = await requireRole(['super_admin'])
  const supabase = await createClient()
  const [{ data: people }, { data: roles }, { data: cities }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, phone, city_id, is_active, created_at').order('full_name'),
    supabase.from('user_roles').select('user_id, role'),
    supabase.from('cities').select('id, name').eq('is_active', true).order('name'),
  ])
  const staff = (people ?? []).map((p) => ({ ...p, role: roles?.find((r) => r.user_id === p.id)?.role })).filter((p) => p.role && p.role !== 'customer')
  const order = ['super_admin', 'cc_exec', 'surveyor']
  staff.sort((a, b) => order.indexOf(a.role!) - order.indexOf(b.role!) || a.full_name.localeCompare(b.full_name))
  return (
    <>
      <PageHeader back={{ href: '/staff/admin', label: 'Admin' }} title="Users & roles" description="What each person sees is set by their role. RLS enforces it in the database, not just the menu."
        actions={<AddStaffButton cities={cities ?? []} />} />
      <div className="relative overflow-x-auto rounded-lg border border-line bg-white shadow-card">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line bg-surface text-left">
            {['Person', 'Role', 'City', 'Active'].map((h) => <th key={h} className="eyebrow px-4 py-3 text-muted-ink">{h}</th>)}
          </tr></thead>
          <tbody>
            {staff.map((p) => (
              <tr key={p.id} className={`border-b border-line last:border-0 ${p.is_active ? '' : 'opacity-60'}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-pale text-xs font-semibold text-redux-blue">{p.full_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}</span>
                    <div><p className="font-medium text-ink">{p.full_name}{p.id === me.id && <span className="ml-1.5 text-xs text-muted-ink">(you)</span>}</p><p className="text-xs text-muted-ink">{p.email} · {p.phone}</p></div>
                  </div>
                </td>
                <td className="px-4 py-3"><span className="rounded-sm bg-surface px-2 py-0.5 text-xs font-semibold text-ink">{ROLE_LABEL[p.role as keyof typeof ROLE_LABEL]}</span></td>
                <td className="px-4 py-3"><StaffCity userId={p.id} cityId={p.city_id} cities={cities ?? []} /></td>
                <td className="px-4 py-3"><StaffActive userId={p.id} active={p.is_active} name={p.full_name} disabled={p.id === me.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
