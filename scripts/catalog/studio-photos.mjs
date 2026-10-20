// Step 8 (scripts/catalog/README.md): REDUX's own studio photos (generated from
// blueprint/05-content/03-image-prompts.md §2–3) → brand/catalog/studio/<sku>.jpg, replacing the product's
// picture. Files are named by code (`ebsen010-a.jpg` = EBSEN-010-A). Usage — node … studio-photos.mjs <dir>
import { createClient } from '@supabase/supabase-js'
import { readdirSync, readFileSync } from 'node:fs'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const DIR = process.argv[2]
const key = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const { data: prods, error } = await admin.from('products').select('id, sku, name').not('sku', 'like', 'GEN-%')
if (error) throw error
const bySku = new Map(prods.map((p) => [key(p.sku), p]))
let done = 0
const missing = []
for (const f of readdirSync(DIR).filter((f) => f.endsWith('.jpg'))) {
  const p = bySku.get(key(f.replace(/\.jpg$/, '')))
  if (!p) { missing.push(f); continue }
  const path = `catalog/studio/${p.sku.toLowerCase()}.jpg`
  const { error: up } = await admin.storage.from('brand').upload(path, readFileSync(`${DIR}/${f}`), { contentType: 'image/jpeg', upsert: true })
  if (up) { missing.push(`${f}: ${up.message}`); continue }
  await admin.from('product_media').delete().eq('product_id', p.id)
  const { error: ins } = await admin.from('product_media').insert({ product_id: p.id, kind: 'image', path, alt: p.name, sort_order: 0 })
  if (ins) { missing.push(`${f}: ${ins.message}`); continue }
  done++
}
console.log('studio photos', done, '· not matched', JSON.stringify(missing))
