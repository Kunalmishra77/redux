import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { publicEnv } from '@/lib/env'

// Next 16: proxy.ts, not middleware.ts.
//
// Three hostnames, one app (architecture §2). Route groups cannot share a URL path, so the staff
// app lives under /staff and the customer portal under /portal; the proxy maps the hostnames onto
// them. On a single demo host (Vercel preview, localhost) the /staff and /portal paths work directly.
//   app.reduxbath.com/leads  →  /staff/leads
//   my.reduxbath.com/        →  /portal
const HOST_PREFIX: Record<string, string> = { app: '/staff', my: '/portal' }

function prefixFor(host: string | null): string | null {
  const sub = host?.split('.')[0]
  return sub && HOST_PREFIX[sub] && host?.endsWith('reduxbath.com') ? HOST_PREFIX[sub] : null
}

export async function proxy(request: NextRequest) {
  const url = request.nextUrl.clone()
  const prefix = prefixFor(request.headers.get('host'))
  if (prefix && !url.pathname.startsWith(prefix)) url.pathname = `${prefix}${url.pathname === '/' ? '' : url.pathname}`

  let response = prefix ? NextResponse.rewrite(url, { request }) : NextResponse.next({ request })

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
        response = prefix ? NextResponse.rewrite(url, { request }) : NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options)
      },
    },
  })

  // Revalidates the JWT and refreshes it when needed. Do not remove.
  const { data } = await supabase.auth.getClaims()
  const role = data?.claims?.user_role as string | undefined
  const path = url.pathname

  // Route protection. RLS is the real guard; this keeps people on the right side of the app.
  const isStaffArea = path.startsWith('/staff') && !path.startsWith('/staff/login')
  const isPortalArea = path.startsWith('/portal') && !path.startsWith('/portal/login')
  if (isStaffArea && (!data?.claims || role === 'customer' || !role)) {
    return NextResponse.redirect(new URL(`/staff/login?next=${encodeURIComponent(path)}`, request.url))
  }
  if (isPortalArea && !data?.claims) {
    return NextResponse.redirect(new URL(`/portal/login?next=${encodeURIComponent(path)}`, request.url))
  }
  return response
}

export const config = {
  // Skip static assets, images and webhooks (webhooks must answer in <200 ms, ADR-008).
  // robots.txt / sitemap.xml are never rewritten: app. and my. must serve the disallow-all robots
  // from app/robots.ts, not a 404 under /staff or /portal (SEO plan §3).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/webhooks|demo/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
