import type { Metadata } from 'next'
import { KeyRound, MapPin, ShieldCheck } from 'lucide-react'
import { PageHeader, Panel } from '@/components/patterns'
import { ROLE_LABEL } from '@/components/shell/nav'
import { requireRole, STAFF_ROLES } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { ProfileForm } from './profile-form'

export const metadata: Metadata = { title: 'My profile' }

// B4 — my details. Contact fields are mine to edit; role, city and active status belong to the
// Super Admin (guard_profile_self_edit), because the city drives lead assignment (BR-L4).
export default async function ProfilePage() {
  const user = await requireRole(STAFF_ROLES)
  const supabase = await createClient()
  const { data: me } = await supabase.from('profiles').select('full_name, email, phone, created_at, city:cities(name)').eq('id', user.id).single()
  const city = (me?.city as unknown as { name: string } | null)?.name
  const demo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
  return (
    <>
      <PageHeader title="My profile" description="Your details as the rest of the team sees them." />
      <div className="grid max-w-4xl gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Panel title="Details">
          <ProfileForm fullName={me?.full_name ?? user.name} phone={me?.phone ?? ''} email={me?.email ?? user.email ?? ''} />
        </Panel>
        <div className="space-y-5">
          <Panel title="Access">
            <dl className="space-y-3 text-sm">
              <div className="flex items-center gap-2"><ShieldCheck className="size-4 text-redux-blue" aria-hidden /><dt className="sr-only">Role</dt><dd className="font-medium text-ink">{ROLE_LABEL[user.role]}</dd></div>
              <div className="flex items-center gap-2"><MapPin className="size-4 text-redux-blue" aria-hidden /><dt className="sr-only">City</dt><dd className="text-ink">{city ?? 'All cities'}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-muted-ink">Your role and city are set by the Super Admin — the city decides which new leads come to you.</p>
          </Panel>
          <Panel title="Password">
            <p className="flex items-start gap-2 text-sm text-muted-ink"><KeyRound className="mt-0.5 size-4 shrink-0 text-redux-blue" aria-hidden />
              {demo ? 'Demo accounts share one password, so changing it is switched off in the demo.' : 'Use “Forgot password” on the sign-in page to set a new one by email.'}</p>
          </Panel>
        </div>
      </div>
    </>
  )
}
