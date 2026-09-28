import 'server-only'

import { createClient } from '@/lib/supabase/server'

/**
 * A viewable URL for a stored photo. Demo photos are static files under /public/demo; real photos
 * are served from Supabase Storage through short-lived signed URLs (BR-X3, 5–15 min) and never
 * proxied through the app host (ADR-003). List views ask for a thumbnail width, never full size.
 */
export async function photoUrls(paths: string[], bucket = 'survey-photos', width?: number): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const real: string[] = []
  for (const p of paths) {
    if (p.startsWith('demo/')) out.set(p, `/${p}`)
    else real.push(p)
  }
  if (real.length) {
    const supabase = await createClient()
    const { data } = await supabase.storage.from(bucket).createSignedUrls(real, 600, width ? { transform: { width } } as never : undefined)
    for (const s of data ?? []) if (s.path && s.signedUrl) out.set(s.path, s.signedUrl)
  }
  return out
}
