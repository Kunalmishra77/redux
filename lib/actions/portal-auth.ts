'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DEMO, checkCode, sendCode, signIn } from '@/lib/auth/phone-otp'
import { normalisePhone } from '@/lib/services/phone'
import type { Result } from '@/lib/result'

// D1s — customer portal login by phone OTP (api-spec §5: 10-minute expiry, 5 attempts). The OTP and
// session mechanics live in lib/auth/phone-otp (shared with business registration).

export async function requestLoginOtpAction(rawPhone: string): Promise<Result<{ demoCode?: string }>> {
  const phone = normalisePhone(rawPhone)
  if (!phone) return { ok: false, code: 'PHONE', message: 'Enter the 10-digit mobile number you gave REDUX.' }
  return sendCode(phone)
}

export async function verifyLoginOtpAction(rawPhone: string, code: string, next?: string): Promise<Result<null>> {
  const phone = normalisePhone(rawPhone)
  if (!phone) return { ok: false, code: 'CODE', message: 'Enter the 6-digit code.' }
  const checked = await checkCode(phone, code)
  if (!checked.ok) return checked
  if (DEMO) {
    const s = await signIn(phone)
    if (!s.ok) return s
  }
  redirect(next && next.startsWith('/portal') ? next : '/portal')
}

export async function portalSignOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/portal/login')
}
