import 'server-only'

import { cookies } from 'next/headers'
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Result } from '@/lib/result'

// Phone OTP for the customer portal: login (D1s) and business registration (CR-001 phase 2) share it.
// Production: Supabase phone auth (SMS via MSG91, DLT-registered) — verifying the code creates the session.
// Demo (NEXT_PUBLIC_DEMO_MODE): the code goes to the demo outbox and is shown on screen; a correct code
// lets the server mint the session from a one-time magic-link token. No password exists either way.

export const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
const COOKIE = 'redux_portal_otp'
const TTL_MS = 10 * 60_000
const MAX_ATTEMPTS = 5

type Pending = { phone: string; hash: string; exp: number; attempts: number }

function sign(data: string) {
  return createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY!).update(data).digest('base64url')
}
function seal(p: Pending) { const body = Buffer.from(JSON.stringify(p)).toString('base64url'); return `${body}.${sign(body)}` }
function unseal(v: string | undefined): Pending | null {
  if (!v) return null
  const [body, mac] = v.split('.')
  if (!body || !mac) return null
  const want = Buffer.from(sign(body)), got = Buffer.from(mac)
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null
  return JSON.parse(Buffer.from(body, 'base64url').toString()) as Pending
}
const hashCode = (phone: string, code: string) => sign(`${phone}:${code}`)

/** Send a code to the phone. Demo: returns it (the screen shows it) and writes it to the outbox. */
export async function sendCode(phone: string): Promise<Result<{ demoCode?: string }>> {
  if (!DEMO) {
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithOtp({ phone, options: { shouldCreateUser: true } })
    if (error) return { ok: false, code: 'OTP', message: 'We couldn’t send a code just now. Try again in a minute.' }
    return { ok: true, data: {} }
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const jar = await cookies()
  jar.set(COOKIE, seal({ phone, hash: hashCode(phone, code), exp: Date.now() + TTL_MS, attempts: 0 }), { httpOnly: true, sameSite: 'lax', secure: true, maxAge: TTL_MS / 1000, path: '/' })
  const admin = createAdminClient()
  const { data: contact } = await admin.from('customer_contacts').select('customer_id').eq('phone', phone).limit(1).maybeSingle()
  await admin.from('messages').insert({
    rule_code: 'LOGIN', template_code: 'login_otp', channel: 'whatsapp', category: 'authentication', to_address: phone,
    customer_id: contact?.customer_id ?? null, entity_type: 'auth', dedup_key: `login_otp:${phone}:${Date.now()}`, variables: { code },
  })
  return { ok: true, data: { demoCode: code } }
}

/**
 * Check the code. Production: verifying it signs the person in. Demo: the sealed cookie is checked
 * (10 minutes, 5 tries); call signIn() afterwards. Either way the caller decides what happens between
 * the check and the session (registration creates the account first, so the new login links to it).
 */
export async function checkCode(phone: string, code: string): Promise<Result<{ signedIn: boolean }>> {
  if (!/^\d{6}$/.test(code)) return { ok: false, code: 'CODE', message: 'Enter the 6-digit code.' }
  if (!DEMO) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' })
    if (error) return { ok: false, code: 'CODE', message: 'That code didn’t match or has expired.' }
    return { ok: true, data: { signedIn: true } }
  }
  const jar = await cookies()
  const p = unseal(jar.get(COOKIE)?.value)
  if (!p || p.phone !== phone || Date.now() > p.exp) return { ok: false, code: 'EXPIRED', message: 'That code has expired. Ask for a new one.' }
  if (p.attempts >= MAX_ATTEMPTS) return { ok: false, code: 'LOCKED', message: 'Too many tries. Ask for a new code.' }
  if (p.hash !== hashCode(phone, code)) {
    jar.set(COOKIE, seal({ ...p, attempts: p.attempts + 1 }), { httpOnly: true, sameSite: 'lax', secure: true, maxAge: Math.max(1, Math.floor((p.exp - Date.now()) / 1000)), path: '/' })
    return { ok: false, code: 'CODE', message: `That code didn’t match. ${MAX_ATTEMPTS - p.attempts - 1} tries left.` }
  }
  jar.delete(COOKIE)
  return { ok: true, data: { signedIn: false } }
}

/** Demo only: mint the session for a phone whose code was just checked. */
export async function signIn(phone: string, name?: string): Promise<Result<null>> {
  const email = await ensurePortalUser(phone, name)
  const admin = createAdminClient()
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (linkErr || !link.properties?.hashed_token) return { ok: false, code: 'SESSION', message: 'Couldn’t sign you in. Try again.' }
  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' })
  if (error) return { ok: false, code: 'SESSION', message: 'Couldn’t sign you in. Try again.' }
  return { ok: true, data: null }
}

/** Demo: the auth user for a phone — existing, or created now (the trigger links its contacts). */
async function ensurePortalUser(phone: string, name?: string): Promise<string> {
  const admin = createAdminClient()
  const bare = phone.replace('+', '')
  for (let page = 1; page < 20; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    const hit = data?.users.find((u) => u.phone === bare)
    if (hit?.email) return hit.email
    if (!data || data.users.length < 200) break
  }
  const email = `p${bare}@portal.redux.demo`
  const { data: contact } = await admin.from('customer_contacts').select('name').eq('phone', phone).limit(1).maybeSingle()
  const { error } = await admin.auth.admin.createUser({ email, phone: bare, email_confirm: true, phone_confirm: true, user_metadata: { full_name: name ?? contact?.name ?? 'Customer', demo: true } })
  if (error && !/already/.test(error.message)) throw error
  return email
}
