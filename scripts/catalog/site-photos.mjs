// Step 5 (scripts/catalog/README.md): usage — node … site-photos.mjs <out>  (reads <out>/eb-site/matches.json)
// Sharper product photos from eurobrass.in — resumable: skips products already on a catalog/eb/ photo,
// retries a dropped download, waits a moment between requests so the site is not hammered.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const DIR = process.argv[2]
const matches = JSON.parse(readFileSync(`${DIR}/eb-site/matches.json`, 'utf8'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const { data: prods } = await admin.from('products').select('id, sku, name, media:product_media(path)').not('sku', 'like', 'GEN-%')
const bySku = new Map(prods.map((p) => [p.sku, p]))

async function get(url) {
  for (let i = 0; i < 4; i++) {
    try { const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } }); if (r.ok) return Buffer.from(await r.arrayBuffer()); }
    catch { /* retry */ }
    await sleep(1500 * (i + 1))
  }
  return null
}

let done = 0, already = 0
const skipped = []
for (const [oldSku, m] of Object.entries(matches)) {
  if (!(m.score >= 0.3 || oldSku === 'DN-7810')) { skipped.push(`${oldSku}: catalogue "${m.name}" vs site "${m.site_desc}"`); continue }
  const p = bySku.get(oldSku) ?? bySku.get(`${oldSku}-A`)
  if (!p) { skipped.push(`${oldSku}: not found`); continue }
  if (p.media.some((x) => x.path.startsWith('catalog/eb/'))) { already++; continue }
  const buf = await get(m.url)
  if (!buf) { skipped.push(`${p.sku}: download failed`); continue }
  const path = `catalog/eb/${p.sku.toLowerCase()}.jpg`
  const { error } = await admin.storage.from('brand').upload(path, buf, { contentType: 'image/jpeg', upsert: true })
  if (error) { skipped.push(`${p.sku}: upload ${error.message}`); continue }
  await admin.from('product_media').delete().eq('product_id', p.id)
  await admin.from('product_media').insert({ product_id: p.id, kind: 'image', path, alt: p.name, sort_order: 0 })
  done++
  await sleep(250)
}
console.log('photos upgraded now', done, '· already', already)
console.log('not upgraded:', JSON.stringify(skipped, null, 1))
