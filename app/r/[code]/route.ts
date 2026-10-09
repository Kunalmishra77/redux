import { NextResponse, type NextRequest } from 'next/server'

// CR-001 phase 6 (D29, BR-R1) — a referral link: /r/{code}. Remembers the code for 30 days (the
// enquiry and registration forms send it as a referral, never as the lead source) and opens the
// business registration page with it filled in.
export async function GET(req: NextRequest, ctx: RouteContext<'/r/[code]'>) {
  const { code } = await ctx.params
  const clean = code.toUpperCase()
  const to = new URL('/register', req.url)
  if (!/^[A-Z0-9]{4,12}$/.test(clean)) return NextResponse.redirect(to)
  to.searchParams.set('ref', clean)
  const res = NextResponse.redirect(to)
  res.cookies.set('redux_ref', clean, { maxAge: 30 * 86_400, sameSite: 'lax', path: '/', secure: true })
  return res
}
