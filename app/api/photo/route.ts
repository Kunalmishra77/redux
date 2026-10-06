import { createClient } from '@/lib/supabase/server'

// DEMO ONLY — serves a stored photo through the app. Production hands the browser a short-lived
// signed URL and never proxies photos (05-storage-media §5, egress). Some Indian ISPs block
// *.supabase.co, so in the demo a laptop on such a network would show every real photo broken.
// The read runs as the signed-in user, so storage RLS still decides who may see which photo.
const BUCKETS = new Set(['survey-photos', 'handover-photos'])

export async function GET(request: Request) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') return new Response('Not found', { status: 404 })
  const url = new URL(request.url)
  const bucket = url.searchParams.get('b') ?? ''
  const path = url.searchParams.get('p') ?? ''
  const width = Number(url.searchParams.get('w')) || undefined
  if (!BUCKETS.has(bucket) || !path || path.includes('..')) return new Response('Bad request', { status: 400 })

  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getClaims()
  if (!auth?.claims) return new Response('Sign in', { status: 401 })
  const { data, error } = await supabase.storage.from(bucket).download(path, width ? { transform: { width, quality: 75 } } : undefined)
  if (error || !data) return new Response('Not found', { status: 404 })
  return new Response(data, {
    headers: { 'content-type': data.type || 'image/jpeg', 'cache-control': 'private, max-age=600' },
  })
}
