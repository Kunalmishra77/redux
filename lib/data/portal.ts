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
  let { data: customers } = await supabase.from('customers').select('id, name, type').order('name')
  // A login made while the customer was still a prospect is linked once they convert — the same
  // rule trg_link_portal_user applies to logins created after conversion (phone match, active contact).
  if (phone && !customers?.length && (await linkPortalContact(c.sub, phone))) {
    ;({ data: customers } = await supabase.from('customers').select('id, name, type').order('name'))
  }
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

async function linkPortalContact(userId: string, phone: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: contacts } = await admin.from('customer_contacts').select('id, customer:customers!inner(is_prospect)')
    .eq('phone', phone).eq('is_active', true).is('user_id', null).eq('customers.is_prospect', false)
  const ids = (contacts ?? []).map((x) => x.id)
  if (!ids.length) return false
  const { error } = await admin.from('customer_contacts').update({ user_id: userId }).in('id', ids)
  return !error
}

/** Quotations sent to this phone that are waiting for approval — prospects can't list them via RLS. */
export async function quotesAwaitingPhone(phone: string | null) {
  if (!phone) return []
  const admin = createAdminClient()
  const { data: contacts } = await admin.from('customer_contacts').select('customer_id').eq('phone', phone).eq('is_active', true)
  const ids = (contacts ?? []).map((x) => x.customer_id)
  if (!ids.length) return []
  const { data } = await admin.from('quotations').select('id, quote_no, version, total, you_save, valid_until')
    .in('customer_id', ids).eq('status', 'sent').order('created_at', { ascending: false })
  return data ?? []
}

export async function requestContext() {
  const h = await headers()
  return { ip: (h.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || null, userAgent: h.get('user-agent') }
}
