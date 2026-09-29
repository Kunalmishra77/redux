import 'server-only'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type PortalUser = { id: string; phone: string | null; name: string; customerIds: string[]; customers: { id: string; name: string; type: string }[] }

/** The signed-in portal user and the customer accounts they are a contact of (my_customer_ids). */
export async function requirePortalUser(next?: string): Promise<PortalUser> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const c = data?.claims
  if (!c?.sub) redirect(`/portal/login${next ? `?next=${encodeURIComponent(next)}` : ''}`)
  if (c.user_role && c.user_role !== 'customer') redirect('/staff')
  const phone = c.phone ? `+${String(c.phone).replace(/^\+/, '')}` : null
  const { data: customers } = await supabase.from('customers').select('id, name, type').order('name')
  const meta = (c.user_metadata ?? {}) as { full_name?: string }
  let name = meta.full_name ?? 'there'
  if (phone) {
    const { data: contact } = await supabase.from('customer_contacts').select('name').eq('phone', phone).limit(1).maybeSingle()
    if (contact?.name) name = contact.name
  }
  return { id: c.sub, phone, name, customerIds: (customers ?? []).map((x) => x.id), customers: customers ?? [] }
}

/**
 * A quotation the signed-in person may view and approve. A customer sees theirs through RLS; a
 * PROSPECT has no portal access yet (my_customer_ids excludes prospects), so the quote they were
 * sent is released to them only when their verified phone is a contact of the quote's customer.
 * Read server-side with the service role, for that one quote only (deviation — see tracker).
 */
export async function quoteForPortal(quoteId: string, user: PortalUser) {
  const supabase = await createClient()
  const own = await supabase.from('quotations').select('id').eq('id', quoteId).maybeSingle()
  const admin = createAdminClient()
  if (!own.data) {
    if (!user.phone) return null
    const { data: q } = await admin.from('quotations').select('customer_id, status').eq('id', quoteId).maybeSingle()
    if (!q || ['draft', 'pending_approval'].includes(q.status)) return null
    const { data: contact } = await admin.from('customer_contacts').select('id').eq('customer_id', q.customer_id).eq('phone', user.phone).eq('is_active', true).maybeSingle()
    if (!contact) return null
  }
  return admin
}

export async function requestContext() {
  const h = await headers()
  return { ip: (h.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || null, userAgent: h.get('user-agent') }
}
