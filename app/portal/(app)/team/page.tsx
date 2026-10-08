import type { Metadata } from 'next'
import { ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requirePortalUser } from '@/lib/data/portal'
import { InviteColleague, RemoveColleague } from './team-controls'

export const metadata: Metadata = { title: 'Team' }

const ROLE: Record<string, string> = { owner: 'Owner', engineering: 'Engineering', accounts: 'Accounts', purchase: 'Purchase', operations: 'Operations', other: 'Other' }

// CR-001 phase 2 (D25) — who at the business can use this account. Admins add and remove colleagues;
// each colleague signs in with their own mobile number.
export default async function TeamPage() {
  const user = await requirePortalUser()
  const supabase = await createClient()
  const { data } = await supabase.from('customer_contacts').select('id, customer_id, name, phone, role_code, role_title, is_admin, user_id').eq('is_active', true).order('is_admin', { ascending: false })
  const contacts = data ?? []
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Team</h1>
        <p className="mt-1 text-sm text-muted-ink">Colleagues who can see this account — each signs in with their own mobile number.</p>
      </div>
      {user.customers.map((acc) => {
        const isAdmin = user.adminOf.includes(acc.id)
        return (
          <section key={acc.id} className="rounded-xl border border-line bg-white p-5 shadow-card">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold text-ink">{acc.name}</h2>
              {isAdmin && <InviteColleague customerId={acc.id} />}
            </div>
            <ul className="divide-y divide-line">
              {contacts.filter((c) => c.customer_id === acc.id).map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium text-ink">{c.name}{c.user_id === user.id && <span className="ml-1.5 text-xs text-muted-ink">(you)</span>}</p>
                    <p className="num text-xs text-muted-ink">{c.phone} · {ROLE[c.role_code ?? ''] ?? c.role_title ?? 'Contact'}{c.user_id ? ' · signed in before' : ' · not signed in yet'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.is_admin && <span className="inline-flex items-center gap-1 rounded-sm bg-pale px-2 py-0.5 text-xs font-semibold text-redux-blue"><ShieldCheck className="size-3.5" aria-hidden /> Admin</span>}
                    {isAdmin && c.user_id !== user.id && <RemoveColleague contactId={c.id} name={c.name} />}
                  </div>
                </li>
              ))}
            </ul>
            {!isAdmin && <p className="mt-3 text-xs text-muted-ink">Ask an account admin to add or remove colleagues.</p>}
          </section>
        )
      })}
    </div>
  )
}
