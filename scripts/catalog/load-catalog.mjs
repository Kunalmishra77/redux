// Run from a folder where @supabase/supabase-js resolves (the repo root does). See README.md.
// Load the Eurobrass 2025 catalogue into staging: categories, photos (brand bucket), products (via
// import_products as the Super Admin — the same path as Admin → Catalog), then retire the placeholders.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const U = process.env.NEXT_PUBLIC_SUPABASE_URL
const admin = createClient(U, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const DIR = process.argv[2]
const rows = JSON.parse(readFileSync(`${DIR}/rows.json`, 'utf8'))

// 1 categories (in catalogue order); old generic ones retired
const CATS = [
  ['basin-mixers', 'Basin mixers'], ['pillar-taps', 'Pillar taps & cocks'], ['wall-mixers', 'Wall & shower mixers'], ['diverters', 'Diverters'],
  ['spouts', 'Bath spouts'], ['bib-cocks', 'Bib cocks'], ['sink-mixers', 'Sink mixers & cocks'], ['valves', 'Valves & stopcocks'],
  ['showers', 'Showers'], ['sensor-taps', 'Sensor taps'], ['accessories', 'Bath accessories'],
]
for (const [i, [slug, name]] of CATS.entries()) {
  const { error } = await admin.from('product_categories').upsert({ slug, name, sort_order: (i + 1) * 10, is_active: true }, { onConflict: 'slug' })
  if (error) throw error
}
await admin.from('product_categories').update({ is_active: false }).in('slug', ['mixers', 'spouts-faucets', 'valves-accessories'])
console.log('categories', CATS.length)

// 2 photos
let up = 0
for (const r of rows.filter((x) => x.src_image)) {
  const { error } = await admin.storage.from('brand').upload(r.image, readFileSync(`${DIR}/img/${r.src_image}`), { contentType: 'image/jpeg', upsert: true })
  if (error) { console.log('upload', r.sku, error.message); continue }
  up++
}
console.log('photos uploaded', up)

// 3 products, as the Super Admin through import_products
const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'vikram@redux.demo' })
const vik = createClient(U, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
await vik.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' })
const TAPWARE = new Set(['basin-mixers', 'pillar-taps', 'wall-mixers', 'diverters', 'spouts', 'bib-cocks', 'sink-mixers', 'valves', 'sensor-taps'])
const payload = rows.map((r, i) => ({
  sku: r.sku, name: r.name, category: r.category, fitting_type: r.fitting_type, description: r.description,
  specs: r.specs, image: r.image, published: true, sort: String(i + 1),
  benefits: TAPWARE.has(r.category) ? ['Lead-free castings across the range', 'Water-saving aerators and cartridges', 'Designed and made in Eurobrass’s own facilities'] : [],
  restore_info: r.fitting_type
    ? 'Already have this kind of fitting? A REDUX assessment prices restoring your existing one — its finish, its mechanism, or both — against replacing it with this Eurobrass model, side by side.'
    : '',
}))
let created = 0, updated = 0
const errors = []
for (let i = 0; i < payload.length; i += 120) {
  const { data, error } = await vik.rpc('import_products', { p: payload.slice(i, i + 120) })
  if (error) throw error
  created += data.created; updated += data.updated; errors.push(...data.errors)
}
console.log('products created', created, 'updated', updated, 'errors', JSON.stringify(errors.slice(0, 10)))

// 4 retire the generic placeholders
const { data: gen } = await admin.from('products').update({ is_published: false }).like('sku', 'GEN-%').select('sku')
console.log('placeholders unpublished', gen?.length)
const { count } = await admin.from('products').select('id', { count: 'exact', head: true }).eq('is_published', true)
console.log('published products now', count)
