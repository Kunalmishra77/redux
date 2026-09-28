'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createHash } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Result } from '@/lib/result'

// Quotation actions (D10). The rules live in the database functions: BR-A1 (all assessed), BR-A6
// (discount gate), BR-Q1/Q3 (validity, terms snapshot), BR-Q2/Q7 (versions, immutability).

const PG_MESSAGES: Record<string, string> = {
  '23514': 'Something on this quote needs attention first.',
  '22023': 'This quote can’t do that in its current state.',
  '42501': 'You can’t change this quote.',
  '55000': 'The warranty terms aren’t loaded yet (Admin → Settings).',
}
const fail = (code: string | undefined, message?: string) => ({ ok: false as const, code: code ?? 'FAILED', message: message ?? PG_MESSAGES[code ?? ''] ?? 'That didn’t work. Try again.' })

export async function createQuoteAction(surveyId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_quote_from_survey', { p_survey: surveyId })
  if (error) return fail(error.code, error.message.includes('BR-A1') ? error.message.replace(/\s*\(BR-A1\)/, '') : undefined)
  revalidatePath('/staff/quotes')
  redirect(`/staff/quotes/${data}`)
}

export async function setDiscountAction(quoteId: string, pct: number, reason?: string): Promise<Result<{ status: string }>> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('set_quote_discount', { p_quote: quoteId, p_pct: pct, p_reason: reason ?? undefined })
  if (error) return fail(error.code, error.code === '23514' ? 'A discount above the threshold needs a reason for the approver.' : undefined)
  revalidatePath(`/staff/quotes/${quoteId}`)
  return { ok: true, data: { status: String(data) } }
}

export async function decideDiscountAction(approvalId: string, approve: boolean, note?: string): Promise<Result<null>> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('decide_discount', { p_approval: approvalId, p_approve: approve, p_note: note ?? undefined })
  if (error) return fail(error.code)
  revalidatePath('/staff/admin/discounts')
  revalidatePath('/staff/quotes', 'layout')
  return { ok: true, data: null }
}

/**
 * Issue & send (B19): freeze validity + terms, render the PDF from those frozen values, record its
 * SHA-256, then send. The PDF is rendered by Gotenberg from /quotes/[id]/preview in production; in
 * the demo the hash is taken over the frozen quote content, and the WhatsApp is simulated.
 */
export async function issueQuoteAction(quoteId: string): Promise<Result<null>> {
  const supabase = await createClient()
  const frozen = await supabase.rpc('freeze_quote_for_issue', { p_quote: quoteId })
  if (frozen.error) return fail(frozen.error.code)
  const { data: q } = await supabase.from('quotations').select('quote_no, version, total, valid_until, terms_version, lead_id, customer_id').eq('id', quoteId).single()
  const sha = createHash('sha256').update(JSON.stringify(q)).digest('hex')
  const sent = await supabase.rpc('mark_quote_sent', { p_quote: quoteId, p_pdf_path: `quotes/${quoteId}.pdf`, p_pdf_sha256: sha })
  if (sent.error) return fail(sent.error.code)

  // CN5 "quote shared" — queued like every notification (demo outbox shows it)
  if (q) {
    const admin = createAdminClient()
    const { data: contact } = await admin.from('customer_contacts').select('phone, name').eq('customer_id', q.customer_id).order('is_primary', { ascending: false }).limit(1).maybeSingle()
    const { count } = await admin.from('quotation_lines').select('id', { count: 'exact', head: true }).eq('quotation_id', quoteId)
    if (contact) {
      await admin.from('messages').insert({
        rule_code: 'CN5', template_code: 'quote_shared', channel: 'whatsapp', category: 'utility', to_address: contact.phone,
        lead_id: q.lead_id, customer_id: q.customer_id, entity_type: 'quotations', entity_id: quoteId, dedup_key: `CN5:${quoteId}`,
        variables: { name: contact.name.split(' ')[0], quote_no: `${q.quote_no} v${q.version}`, fittings: count ?? 0,
          total: `₹${Number(q.total).toLocaleString('en-IN')}`, valid_until: q.valid_until },
      })
    }
  }
  revalidatePath(`/staff/quotes/${quoteId}`)
  revalidatePath('/staff/quotes')
  return { ok: true, data: null }
}

export async function newVersionAction(quoteId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_quote_version', { p_quote: quoteId })
  if (error) return fail(error.code)
  revalidatePath('/staff/quotes', 'layout')
  redirect(`/staff/quotes/${data}`)
}
