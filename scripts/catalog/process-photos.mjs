// Step 7 (scripts/catalog/README.md): eurobrass.in Technology page photos 2–6.jpg, re-saved as RGB p1–p5.jpg in <dir> (the originals are CMYK —
// convert with PIL `.convert('RGB')`; a plain re-encode inverts the colours),
// → brand/catalog/process/stage-<n>-rgb.jpg (lib/content/process.ts PROCESS_STAGES). Usage — node … process-photos.mjs <dir>
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const dir = process.argv[2]
for (let i = 1; i <= 5; i++) {
  const { error } = await admin.storage.from('brand').upload(`catalog/process/stage-${i}-rgb.jpg`, readFileSync(`${dir}/p${i}.jpg`), { contentType: 'image/jpeg', upsert: true })
  console.log(i, error?.message ?? 'ok')
}
