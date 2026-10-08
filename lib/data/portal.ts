import 'server-only'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type PortalUser = { id: string; phone: string | null; name: string; customerIds: string[]; customers: { id: string; name: string; type: string }[] }

/** The signed-in portal user and the accounts they are a contact of (my_customer_ids, ADR-016). */
export async function requirePortalUser(next?: string): Promise<PortalUser> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const c = data?.claims
  if (!c?.sub) redirect(`/portal/login${next ? `?next=${encodeURIComponent(next)}` : ''}`)
  if (c.user_role && c.user_role !== 'customer') redirect('/staff')
  const phone = c.phone ? `+${String(c.phone).replace(/^\+/, '')}` : null
  // A contact added after this login existed (a new account for the same number) is linked on the
  // next visit — the same rule trg_link_portal_user applies when a login is created.
  if (phone) await linkPortalContacts(c.sub, phone)
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
 * Can the signed-in person see (and so approve) this quotation? Decided by RLS alone: since
 * ADR-016 a prospect account's contacts see its sent quotations like any customer.
 */
export async function canSeeQuote(quoteId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase.from('quotations').select('id').eq('id', quoteId).maybeSingle()
  return !!data
}

async function linkPortalContacts(userId: string, phone: string) {
  const admin = createAdminClient()
  await admin.from('customer_contacts').update({ user_id: userId }).eq('phone', phone).eq('is_active', true).is('user_id', null)
}

/** Quotations waiting for this person's approval (RLS: their accounts, sent only). */
export async function quotesAwaitingApproval() {
  const supabase = await createClient()
  const { data } = await supabase.from('quotations').select('id, quote_no, version, total, you_save, valid_until')
    .eq('status', 'sent').order('created_at', { ascending: false })
  return data ?? []
}

export async function requestContext() {
  const h = await headers()
  return { ip: (h.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || null, userAgent: h.get('user-agent') }
}
