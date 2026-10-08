'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEMO, checkCode, sendCode, signIn } from '@/lib/auth/phone-otp'
import { registrationSchema, type RegistrationInput } from '@/lib/validators/registration'
import { clientIp } from '@/lib/services/enquiry'
import type { Result } from '@/lib/result'

// CR-001 phase 2 (E19, D25) — "Create business account": details → mobile code → account + session.
// register_business() does the work in one transaction (lead + consent + account + admin contact,
// BR-B1/B2); this action only validates, checks the code and signs the person in.

type Fields = Record<string, string>
type RegisterResult = Result<{ demoCode?: string; phone: string }> & { fields?: Fields }

function fieldErrors(input: RegistrationInput): { fields: Fields } | null {
  const parsed = registrationSchema.safeParse(input)
  if (parsed.success) return null
  const fields: Fields = {}
  for (const i of parsed.error.issues) { const k = String(i.path[0]); if (!fields[k]) fields[k] = i.message }
  return { fields }
}

export async function startRegistrationAction(input: RegistrationInput, honeypot: string): Promise<RegisterResult> {
  if (honeypot.trim()) return { ok: false, code: 'SPAM', message: 'Please try again.' }
  const bad = fieldErrors(input)
  if (bad) return { ok: false, code: 'INVALID', message: 'Please check the highlighted fields.', ...bad }
  const data = registrationSchema.parse(input)
  const sent = await sendCode(data.phone)
  if (!sent.ok) return sent
  return { ok: true, data: { ...sent.data, phone: data.phone } }
}

export async function completeRegistrationAction(input: RegistrationInput, code: string): Promise<Result<null>> {
  const parsed = registrationSchema.safeParse(input)
  if (!parsed.success) return { ok: false, code: 'INVALID', message: 'Please check the form and try again.' }
  const d = parsed.data
  const checked = await checkCode(d.phone, code)
  if (!checked.ok) return checked

  const h = await headers()
  const admin = createAdminClient()
  const { error } = await admin.rpc('register_business', {
    p: {
      phone: d.phone, business_name: d.businessName, legal_name: d.legalName, segment: d.segment,
      size_units: d.sizeUnits === undefined ? null : String(d.sizeUnits), city_id: d.cityId, pincode: d.pincode,
      contact_name: d.contactName, role_title: d.roleTitle, email: d.email, gstin: d.gstin, referred_by: d.referredBy,
    },
    p_consent: {
      notice_version: d.noticeVersion, language: 'en', method: 'web_form',
      ip_address: clientIp(h.get('x-forwarded-for'), h.get('x-real-ip')), user_agent: h.get('user-agent')?.slice(0, 500),
      purposes: { service: true, marketing: d.consentMarketing === true },
    },
  })
  if (error) {
    return { ok: false, code: error.code ?? 'FAILED', message: error.code === '23514' ? error.message.replace(/\s*\(BR-[A-Z0-9]+\)/, '') : 'We couldn’t create the account just now. Please try again.' }
  }
  if (DEMO) {
    const s = await signIn(d.phone, d.contactName)
    if (!s.ok) return s
  }
  redirect('/portal?welcome=1')
}
