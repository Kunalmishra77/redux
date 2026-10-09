import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// CR-001 phase 4 (D27, BR-S10) — a customer's self-assessment photo. The customer's own session asks
// the database whether this fitting and slot are theirs to fill (self_assessment_photo_path); only
// then is the file stored, under the same path scheme the surveyor app uses, and recorded as the
// customer. Uploading through the app (not straight to Storage) keeps it working on networks that
// block *.supabase.co, and lets the server hash the exact bytes it stored.

const MAX = 5 * 1024 * 1024   // the bucket's own limit

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null)
  const fittingId = String(form?.get('fittingId') ?? '')
  const slot = String(form?.get('slot') ?? '')
  const file = form?.get('file')
  const width = Number(form?.get('width') ?? 0) || null
  const height = Number(form?.get('height') ?? 0) || null
  if (!(file instanceof Blob) || !/^[0-9a-f-]{36}$/.test(fittingId)) {
    return NextResponse.json({ ok: false, message: 'Choose a photo.' }, { status: 400 })
  }
  if (file.size === 0 || file.size > MAX) return NextResponse.json({ ok: false, message: 'That photo is too large — try again.' }, { status: 413 })
  const bytes = Buffer.from(await file.arrayBuffer())
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8)) return NextResponse.json({ ok: false, message: 'Please send a photo (JPEG).' }, { status: 415 })

  const supabase = await createClient()
  const { data: prefix, error: pathError } = await supabase.rpc('self_assessment_photo_path', { p_fitting: fittingId, p_slot: slot })
  if (pathError || !prefix) {
    const status = pathError?.code === '42501' ? 403 : 400
    return NextResponse.json({ ok: false, message: pathError?.code === '22023' || pathError?.code === '42501' ? pathError.message.replace(/ \(BR-[A-Z0-9]+\)/, '') : 'That photo could not be saved.' }, { status })
  }

  const sha = createHash('sha256').update(bytes).digest('hex')
  const path = `${prefix}${sha}.jpg`
  const admin = createAdminClient()
  const { error: upError } = await admin.storage.from('survey-photos').upload(path, bytes, { contentType: 'image/jpeg', upsert: false })
  if (upError && !/exists|duplicate/i.test(upError.message)) {
    return NextResponse.json({ ok: false, message: 'The upload did not finish — try again.' }, { status: 502 })
  }
  const { error } = await supabase.rpc('self_assessment_add_photo', {
    p_fitting: fittingId, p_slot: slot, p_path: path, p_sha256: sha, p_bytes: bytes.length, p_width: width as number, p_height: height as number,
  })
  if (error) return NextResponse.json({ ok: false, message: 'That photo could not be saved.' }, { status: 400 })
  return NextResponse.json({ ok: true })
}
