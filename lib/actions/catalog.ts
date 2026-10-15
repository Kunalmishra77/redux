'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import type { Result } from '@/lib/result'

// CR-001 phase 7 (E24, D30) — catalog admin. Import validation is in import_products(); writes are
// Super Admin only (RLS and the function both say so).

function refresh() {
  revalidatePath('/staff/admin/catalog')
  revalidatePath('/products', 'layout')
}

export type ImportResult = { created: number; updated: number; errors: { row: number; sku: string | null; error: string }[] }

export async function importProductsAction(rows: Record<string, string>[]): Promise<Result<ImportResult>> {
  await requireRole(['super_admin'])
  if (!rows.length) return { ok: false, code: 'EMPTY', message: 'The file has no product rows.' }
  if (rows.length > 2000) return { ok: false, code: 'TOO_MANY', message: 'Import up to 2,000 products at a time.' }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('import_products', {
    // columns named "spec:<Name>" become product details (code, series, size, …)
    p: rows.map((r) => {
      const specs = Object.fromEntries(Object.entries(r).filter(([k, v]) => k.startsWith('spec:') && v).map(([k, v]) => [k.slice(5).trim().replace(/^./, (c) => c.toUpperCase()), v]))
      return { ...r, specs, published: /^(yes|true|1|y)$/i.test(r.published ?? '') }
    }),
  })
  if (error) return { ok: false, code: error.code ?? 'FAILED', message: error.code === '42501' ? error.message : 'The import could not run. Check the file and try again.' }
  refresh()
  return { ok: true, data: data as ImportResult }
}

export async function setProductPublishedAction(id: string, published: boolean): Promise<Result<null>> {
  await requireRole(['super_admin'])
  const supabase = await createClient()
  const { error } = await supabase.from('products').update({ is_published: published }).eq('id', id)
  if (error) return { ok: false, code: error.code ?? 'FAILED', message: 'That didn’t save. Try again.' }
  refresh()
  return { ok: true, data: null }
}

const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/** One image for a product, into the public brand bucket (catalog/{sku}/…). */
export async function uploadProductImageAction(form: FormData): Promise<Result<null>> {
  await requireRole(['super_admin'])
  const productId = String(form.get('productId') ?? '')
  const kind = String(form.get('kind') ?? 'image')
  const file = form.get('file')
  if (!(file instanceof File) || !IMAGE_TYPES[file.type]) return { ok: false, code: 'TYPE', message: 'Choose a JPEG, PNG or WebP image.' }
  if (file.size > 5 * 1024 * 1024) return { ok: false, code: 'SIZE', message: 'Images up to 5 MB.' }
  if (!['image', 'before', 'after'].includes(kind)) return { ok: false, code: 'KIND', message: 'Unknown image kind.' }
  const supabase = await createClient()
  const { data: p } = await supabase.from('products').select('sku, name').eq('id', productId).maybeSingle()
  if (!p) return { ok: false, code: 'NOT_FOUND', message: 'Product not found.' }
  const path = `catalog/${p.sku.toLowerCase()}/${kind}-${Date.now()}.${IMAGE_TYPES[file.type]}`
  const { error: up } = await supabase.storage.from('brand').upload(path, file, { contentType: file.type, upsert: false })
  if (up) return { ok: false, code: 'UPLOAD', message: 'The upload did not finish — try again.' }
  const { error } = await supabase.from('product_media').insert({ product_id: productId, kind, path, alt: `${p.name}${kind === 'image' ? '' : ` — ${kind}`}`, sort_order: kind === 'before' ? 1 : kind === 'after' ? 2 : 0 })
  if (error) return { ok: false, code: error.code ?? 'FAILED', message: 'The image was stored but not linked. Try again.' }
  refresh()
  return { ok: true, data: null }
}
