import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { photoUrls } from '@/lib/data/photos'

export type RestoredFitting = { id: string; name: string; unit: string | null; work: string | null; before: string | null; after: string | null }

/**
 * Restored fittings with their before (survey, front slot) and after (handover) photos, for the
 * customer's own jobs. Thumbnails only in lists (egress, CLAUDE.md).
 */
export async function loadRestoredFittings(limit?: number): Promise<RestoredFitting[]> {
  const supabase = await createClient()
  const { data: jobs } = await supabase.from('jobs').select('quotation_id')
  const quoteIds = (jobs ?? []).map((j) => j.quotation_id)
  if (!quoteIds.length) return []
  const { data: lines } = await supabase.from('quotation_lines')
    .select('fitting_id, unit_label, description, work:work_types(name)').in('quotation_id', quoteIds).order('sort_order')
  const ids = [...new Set((lines ?? []).map((l) => l.fitting_id).filter(Boolean))] as string[]
  const pick = limit ? ids.slice(0, limit) : ids
  if (!pick.length) return []
  const [{ data: before }, { data: after }, { data: fittings }] = await Promise.all([
    supabase.from('fitting_photos').select('fitting_id, storage_path').in('fitting_id', pick).eq('slot', 'front'),
    supabase.from('handover_photos').select('fitting_id, storage_path').in('fitting_id', pick),
    supabase.from('fittings').select('id, ft:fitting_types(name), finish:finishes(name)').in('id', pick),
  ])
  const urls = await photoUrls([...(before ?? []), ...(after ?? [])].map((p) => p.storage_path), 'survey-photos', 480)
  return pick.map((id) => {
    const l = (lines ?? []).find((x) => x.fitting_id === id)
    const f = (fittings ?? []).find((x) => x.id === id) as unknown as { ft: { name: string } | null; finish: { name: string } | null } | undefined
    const b = before?.find((p) => p.fitting_id === id)?.storage_path
    const a = after?.find((p) => p.fitting_id === id)?.storage_path
    return {
      id, unit: l?.unit_label ?? null, work: (l?.work as unknown as { name: string } | null)?.name ?? null,
      name: [f?.ft?.name, f?.finish?.name].filter(Boolean).join(' · ') || (l?.description ?? 'Fitting'),
      before: b ? urls.get(b) ?? null : null, after: a ? urls.get(a) ?? null : null,
    }
  })
}
