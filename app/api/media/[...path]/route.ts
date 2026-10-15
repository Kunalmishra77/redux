import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// CR-001 phase 7 (D30) — catalog pictures from the public brand bucket, served through the app so
// they load on networks that block *.supabase.co (the demo's case; production links the bucket
// directly). Only the public catalog folder, and cached hard at the edge: these files never change
// (a new upload gets a new name).
export async function GET(_req: NextRequest, ctx: RouteContext<'/api/media/[...path]'>) {
  const { path } = await ctx.params
  const key = path.join('/')
  if (!/^catalog\/[a-z0-9._/-]+\.(jpg|jpeg|png|webp)$/.test(key) || key.includes('..')) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 })
  }
  const { data, error } = await createAdminClient().storage.from('brand').download(key)
  if (error || !data) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  return new NextResponse(data, {
    headers: {
      'content-type': data.type || 'image/jpeg',
      'cache-control': 'public, max-age=86400, s-maxage=2592000, immutable',
    },
  })
}
