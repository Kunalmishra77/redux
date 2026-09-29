'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { quoteForPortal, requestContext, requirePortalUser } from '@/lib/data/portal'
import type { Result } from '@/lib/result'

// Customer portal actions (D13). The approval itself is verify_quote_otp() — one transaction that
// records the evidence, approves, converts the prospect and opens the job (BR-Q4/Q5/Q6).

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

const REASONS: Record<string, string> = {
  wrong_code: 'That code didn’t match.',
  expired_code: 'That code has expired. Ask for a new one.',
  locked: 'Too many wrong tries. Ask for a new code.',
  already_used: 'That code was already used.',
  unknown_code: 'Ask for a new code.',
  quote_not_approvable: 'This quotation can no longer be approved — ask REDUX for a fresh one.',
}

export async function requestApprovalOtpAction(quoteId: string): Promise<Result<{ otpId: string; demoCode?: string; phone: string }>> {
  const user = await requirePortalUser()
  if (!user.phone) return { ok: false, code: 'PHONE', message: 'Sign in with your mobile number to approve.' }
  const admin = await quoteForPortal(quoteId, user)
  if (!admin) return { ok: false, code: 'NOT_FOUND', message: 'Quotation not found.' }
  const { data, error } = await admin.rpc('request_quote_otp', { p_quote: quoteId, p_phone: user.phone, p_channel: 'whatsapp' })
  if (error) return { ok: false, code: error.code ?? 'OTP', message: error.code === '53400' ? 'Too many codes requested — try again in an hour.' : error.code === '22023' ? REASONS.quote_not_approvable! : 'We couldn’t send a code. Try again.' }
  const r = data as { otp_id: string; code: string }
  // the code travels on the WhatsApp authentication template (approval_otp); in the demo, the outbox
  const { data: q } = await admin.from('quotations').select('quote_no, version, customer_id, lead_id').eq('id', quoteId).single()
  const sent = await admin.from('messages').insert({
    rule_code: 'OTP', template_code: 'approval_otp', channel: 'whatsapp', category: 'authentication', to_address: user.phone,
    customer_id: q?.customer_id, lead_id: q?.lead_id, entity_type: 'quotations', entity_id: quoteId, dedup_key: `approval_otp:${r.otp_id}`,
    variables: { code: r.code, quote_no: `${q?.quote_no} v${q?.version}` },
  }).select('id').single()
  await admin.rpc('record_otp_delivery', { p_otp: r.otp_id, p_gateway_message_id: DEMO ? `wamid.demo.${sent.data?.id ?? r.otp_id}` : null as unknown as string })
  return { ok: true, data: { otpId: r.otp_id, phone: user.phone, ...(DEMO ? { demoCode: r.code } : {}) } }
}

export async function verifyApprovalOtpAction(quoteId: string, otpId: string, code: string, approverName: string): Promise<Result<{ jobId: string } | { reason: string; attemptsLeft?: number }>> {
  const user = await requirePortalUser()
  const admin = await quoteForPortal(quoteId, user)
  if (!admin) return { ok: false, code: 'NOT_FOUND', message: 'Quotation not found.' }
  if (!/^\d{6}$/.test(code)) return { ok: false, code: 'CODE', message: 'Enter the 6-digit code.' }
  const ctx = await requestContext()
  const { data, error } = await admin.rpc('verify_quote_otp', {
    p_otp: otpId, p_code: code,
    p: { approver_name: approverName.trim() || null, ip_address: ctx.ip, user_agent: ctx.userAgent },
  })
  if (error) return { ok: false, code: error.code ?? 'FAILED', message: 'Approval didn’t go through. Nothing was changed — try again.' }
  const r = data as { ok: boolean; reason?: string; attempts_left?: number; job_id?: string }
  if (!r.ok) {
    const left = r.reason === 'wrong_code' && r.attempts_left !== undefined ? ` ${r.attempts_left} tr${r.attempts_left === 1 ? 'y' : 'ies'} left.` : ''
    return { ok: false, code: r.reason ?? 'FAILED', message: (REASONS[r.reason ?? ''] ?? 'That didn’t work.') + left }
  }
  revalidatePath('/portal', 'layout')
  return { ok: true, data: { jobId: r.job_id! } }
}

export async function raiseServiceRequestAction(input: { customer_id: string; property_id?: string; job_unit_id?: string; warranty_id?: string; subject: string; body?: string }): Promise<Result<{ requestNo: string }>> {
  await requirePortalUser()
  if (input.subject.trim().length < 3) return { ok: false, code: 'SUBJECT', message: 'Tell us briefly what’s wrong.' }
  const supabase = await createClient()
  const clean = Object.fromEntries(Object.entries(input).filter(([, v]) => v))
  const { data, error } = await supabase.rpc('raise_service_request', { p: clean })
  if (error) return { ok: false, code: error.code ?? 'FAILED', message: error.code === '42501' ? 'That room or warranty isn’t on your account.' : 'We couldn’t send that. Try again.' }
  const { data: sr } = await supabase.from('service_requests').select('request_no').eq('id', data as string).maybeSingle()
  revalidatePath('/portal', 'layout')
  return { ok: true, data: { requestNo: sr?.request_no ?? '' } }
}

export async function withdrawMarketingAction(customerId: string): Promise<Result<{ n: number }>> {
  const user = await requirePortalUser()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('withdraw_consent', { p_purpose: 'marketing', p_phone: user.phone ?? (null as unknown as string), p_customer: customerId })
  if (error) return { ok: false, code: error.code ?? 'FAILED', message: 'That didn’t work. Try again.' }
  revalidatePath('/portal/privacy')
  return { ok: true, data: { n: Number(data ?? 0) } }
}

export async function createDsrAction(type: 'access' | 'correction' | 'erasure' | 'nomination' | 'withdraw_consent', customerId: string, details: string): Promise<Result<null>> {
  const user = await requirePortalUser()
  const supabase = await createClient()
  const { error } = await supabase.rpc('create_dsr_request', { p_type: type, p_customer: customerId, p_phone: user.phone ?? (null as unknown as string), p_details: details })
  if (error) return { ok: false, code: error.code ?? 'FAILED', message: 'We couldn’t log that request. Try again.' }
  revalidatePath('/portal/privacy')
  return { ok: true, data: null }
}

/** D10s "Download my data" — everything the portal can see about this account, as JSON. */
export async function exportMyDataAction(customerId: string): Promise<Result<{ json: string }>> {
  const user = await requirePortalUser()
  if (!user.customerIds.includes(customerId)) return { ok: false, code: 'NOT_FOUND', message: 'Account not found.' }
  const supabase = await createClient()
  const [customer, contacts, properties, quotes, jobs, invoices, warranties, requests, consents] = await Promise.all([
    supabase.from('customers').select('*').eq('id', customerId).single(),
    supabase.from('customer_contacts').select('name, phone, email, role_title').eq('customer_id', customerId),
    supabase.from('properties').select('name, address').eq('customer_id', customerId),
    supabase.from('quotations').select('quote_no, version, status, total, issued_at, valid_until').eq('customer_id', customerId),
    supabase.from('jobs').select('job_no, status, current_stage, actual_start, actual_end').eq('customer_id', customerId),
    supabase.from('invoices').select('invoice_no, status, issue_date, total, amount_paid').eq('customer_id', customerId),
    supabase.from('warranties').select('card_no, kind, valid_from, valid_until').in('job_id', (await supabase.from('jobs').select('id').eq('customer_id', customerId)).data?.map((j) => j.id) ?? []),
    supabase.from('service_requests').select('request_no, subject, status, created_at').eq('customer_id', customerId),
    supabase.from('consent_records').select('purpose, granted, notice_version, method, granted_at').eq('customer_id', customerId),
  ])
  const json = JSON.stringify({ exported_at: new Date().toISOString(), customer: customer.data, contacts: contacts.data, properties: properties.data, quotations: quotes.data, jobs: jobs.data, invoices: invoices.data, warranties: warranties.data, service_requests: requests.data, consents: consents.data }, null, 2)
  return { ok: true, data: { json } }
}

