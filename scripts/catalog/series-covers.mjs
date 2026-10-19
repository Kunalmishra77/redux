// Step 6 (scripts/catalog/README.md): the 15 series cover photos from eurobrass.in → brand/catalog/series/<slug>.jpg
// (lib/content/series.ts). Paths are eurobrass.in's own upload paths, found on its series pages.
import { createClient } from '@supabase/supabase-js'
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const C = { pure: '2022/03/1', georgian: '2022/03/n', studio: '2022/04/c', ivy: '2022/03/I1', sigma: '2022/03/o', ronda: '2022/03/l', time: '2022/04/d', aztech: '2022/03/j',
  mode: '2022/03/Untitled-1-2', dune: '2022/03/i', smart: '2022/03/s', neo: '2022/03/m', alpha: '2022/03/p', classic: '2022/03/r', lite: '2022/03/L1' }
for (const [slug, p] of Object.entries(C)) {
  let buf = null
  for (const url of [`https://eurobrass.in/wp-content/uploads/${p}.jpg`, `https://eurobrass.in/wp-content/uploads/${p}-768x910.jpg`]) {
    try { const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } }); if (r.ok) { buf = Buffer.from(await r.arrayBuffer()); console.log(slug, url.endsWith('910.jpg') ? '768x910' : 'full', buf.length); break } } catch {}
  }
  if (!buf) { console.log(slug, 'FAILED'); continue }
  const { error } = await a.storage.from('brand').upload(`catalog/series/${slug}.jpg`, buf, { contentType: 'image/jpeg', upsert: true })
  if (error) console.log(slug, error.message)
}
