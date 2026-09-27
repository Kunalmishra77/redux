import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { publicEnv } from '@/lib/env'

// Next 16: proxy.ts, not middleware.ts. For now this only keeps the Supabase session fresh;
// role-based route protection and hostname routing arrive with E1-S08.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // Revalidates the JWT with Supabase Auth and refreshes it if needed. Do not remove.
  await supabase.auth.getClaims()

  return response
}

export const config = {
  // Skip static assets, images and webhooks (webhooks must answer in <200 ms, ADR-008).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
