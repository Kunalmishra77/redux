import 'server-only'

import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'

// CR-001 phases 7–8 (D30, D31) — public reads for the catalog and the programme pages. Like
// lib/data/website.ts: the site has no session, so these use the service role and select published,
// non-personal columns only, give up after a few seconds, and fall back to empty rather than fail.
const deadline = () => AbortSignal.timeout(4000)

export type CatalogMedia = { kind: string; url: string; alt: string }
export type CatalogProduct = {
  id: string; sku: string; slug: string; name: string; description: string | null; applications: string | null
  benefits: string[]; restore_info: string | null; specs: Record<string, string>
  category: { slug: string; name: string } | null; finishes: string[]; media: CatalogMedia[]
}
export type CatalogCategory = { slug: string; name: string }

/** A stored media path → a URL: site assets (demo/…) are served by the app; uploads live in the public brand bucket. */
export function mediaUrl(path: string): string {
  if (path.startsWith('demo/') || path.startsWith('/')) return path.startsWith('/') ? path : `/${path}`
  if (/^https?:\/\//.test(path)) return path
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/brand/${path}`
}

const SELECT = 'id, sku, slug, name, description, applications, benefits, restore_info, specs, finish_ids, category:product_categories(slug, name), media:product_media(kind, path, alt, sort_order)'

async function finishNames(): Promise<Map<string, string>> {
  const { data } = await createAdminClient().from('finishes').select('id, name').abortSignal(deadline())
  return new Map((data ?? []).map((f) => [f.id, f.name]))
}

function shape(rows: unknown[], names: Map<string, string>): CatalogProduct[] {
  return (rows as (Omit<CatalogProduct, 'finishes' | 'media'> & { finish_ids: string[]; media: { kind: string; path: string; alt: string; sort_order: number }[] })[]).map((p) => ({
    ...p, specs: (p.specs ?? {}) as Record<string, string>,
    finishes: (p.finish_ids ?? []).map((id) => names.get(id)).filter(Boolean) as string[],
    media: [...(p.media ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((m) => ({ kind: m.kind, url: mediaUrl(m.path), alt: m.alt })),
  }))
}

export const getCatalog = cache(async (): Promise<{ categories: CatalogCategory[]; products: CatalogProduct[] }> => {
  try {
    const admin = createAdminClient()
    const [{ data: cats }, { data: prods }, names] = await Promise.all([
      admin.from('product_categories').select('slug, name, sort_order').eq('is_active', true).order('sort_order').abortSignal(deadline()),
      admin.from('products').select(SELECT).eq('is_published', true).order('sort_order').order('name').abortSignal(deadline()),
      finishNames(),
    ])
    const products = shape(prods ?? [], names)
    const used = new Set(products.map((p) => p.category?.slug))
    return { categories: (cats ?? []).filter((c) => used.has(c.slug)).map(({ slug, name }) => ({ slug, name })), products }
  } catch {
    return { categories: [], products: [] }
  }
})

export const getProduct = cache(async (slug: string): Promise<CatalogProduct | null> => {
  try {
    const [{ data }, names] = await Promise.all([
      createAdminClient().from('products').select(SELECT).eq('slug', slug).eq('is_published', true).abortSignal(deadline()).maybeSingle(),
      finishNames(),
    ])
    return data ? shape([data], names)[0]! : null
  } catch {
    return null
  }
})

export type Programmes = {
  referral: { referred_discount_pct: number; referrer_credit_pct: number; free_fitting_every: number; reward_validity_days: number }
  slaHours: number
  nearKm: number
  demoTypes: { code: string; name: string; description: string | null; max_fittings: number; max_units: number; eligible_tiers: string[] }[]
}

export const getProgrammes = cache(async (): Promise<Programmes> => {
  const fallback: Programmes = { referral: { referred_discount_pct: 5, referrer_credit_pct: 5, free_fitting_every: 3, reward_validity_days: 365 }, slaHours: 24, nearKm: 150, demoTypes: [] }
  try {
    const admin = createAdminClient()
    const [{ data: s }, { data: area }, { data: demos }] = await Promise.all([
      admin.from('settings').select('key, value').in('key', ['referral_programme', 'self_assessment_sla_hours']).abortSignal(deadline()),
      admin.from('service_areas').select('near_km').eq('is_active', true).order('near_km', { ascending: false }).limit(1).abortSignal(deadline()).maybeSingle(),
      admin.from('demo_types').select('code, name, description, max_fittings, max_units, eligible_tiers').eq('is_active', true).order('sort_order').abortSignal(deadline()),
    ])
    const get = (k: string) => s?.find((x) => x.key === k)?.value
    return {
      referral: { ...fallback.referral, ...((get('referral_programme') ?? {}) as object) },
      slaHours: Number(get('self_assessment_sla_hours') ?? 24),
      nearKm: Number(area?.near_km ?? 150),
      demoTypes: demos ?? [],
    }
  } catch {
    return fallback
  }
})
