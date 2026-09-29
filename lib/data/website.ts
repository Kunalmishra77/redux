import 'server-only'

import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'

// Public website reads (D1). The site has no session, so these use the service role — and so they
// select named, non-personal columns only: the active notice, the city list, published settings.
// Every read degrades to a safe fallback: a marketing page must render even if the database is down,
// and it gives up after READ_TIMEOUT_MS rather than hang the page (LCP target < 2 s).
const READ_TIMEOUT_MS = 4000
const deadline = () => AbortSignal.timeout(READ_TIMEOUT_MS)

export type City = { id: string; name: string }
export type Notice = { version: string; body: string; effectiveFrom: string }
export type EnquiryContext = { cities: City[]; notice: Notice | null }

export const getEnquiryContext = cache(async (): Promise<EnquiryContext> => {
  try {
    const admin = createAdminClient()
    const [cities, notice] = await Promise.all([
      admin.from('cities').select('id, name').eq('is_active', true).order('name').abortSignal(deadline()),
      // BR-P1: the form shows — and consent is recorded against — the active notice version
      admin
        .from('privacy_notices')
        .select('version, body, effective_from')
        .eq('is_active', true)
        .eq('language', 'en')
        .abortSignal(deadline())
        .maybeSingle(),
    ])
    return {
      cities: (cities.data ?? []) as City[],
      notice: notice.data
        ? { version: notice.data.version, body: notice.data.body, effectiveFrom: notice.data.effective_from }
        : null,
    }
  } catch {
    return { cities: [], notice: null }
  }
})

export type Warranty = { mechanicalDays: number | null; finishDays: number | null }

// A10: warranty periods live in settings.warranty_terms — never hardcoded on the page
export const getWarranty = cache(async (): Promise<Warranty> => {
  try {
    const { data } = await createAdminClient().from('settings').select('value').eq('key', 'warranty_terms').abortSignal(deadline()).maybeSingle()
    const v = (data?.value ?? {}) as { mechanical_days?: unknown; finish_days?: unknown }
    const days = (x: unknown) => (typeof x === 'number' && x > 0 ? x : null)
    return { mechanicalDays: days(v.mechanical_days), finishDays: days(v.finish_days) }
  } catch {
    return { mechanicalDays: null, finishDays: null }
  }
})

// A11: the legal entity named in the footer copyright line
export const getLegalName = cache(async (): Promise<string | null> => {
  try {
    const { data } = await createAdminClient().from('settings').select('value').eq('key', 'supplier_legal_name').abortSignal(deadline()).maybeSingle()
    return typeof data?.value === 'string' && data.value.trim() ? data.value : null
  } catch {
    return null
  }
})
