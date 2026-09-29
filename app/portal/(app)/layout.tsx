import Link from 'next/link'
import { LogOut } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { PortalBottomBar, PortalTabs } from '@/components/portal/portal-nav'
import { requirePortalUser } from '@/lib/data/portal'
import { portalSignOutAction } from '@/lib/actions/portal-auth'

// Customer portal shell (D13): same tokens, softer density, phone-first.
export default async function PortalLayout({ children }: LayoutProps<'/portal'>) {
  const user = await requirePortalUser()
  const demo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
  return (
    <div className="min-h-screen bg-surface pb-20 md:pb-0">
      {demo && (
        <p className="bg-ink px-4 py-1.5 text-center text-xs text-white">
          Demo — WhatsApp, OTP and payments are simulated. <Link href="/demo/outbox" className="font-semibold text-redux-lime hover:underline">See the messages →</Link>
        </p>
      )}
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/portal" aria-label="REDUX portal home"><Logo /></Link>
          <PortalTabs />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-ink">{user.name}</p>
              <p className="text-xs text-muted-ink">{user.customers.map((c) => c.name).join(' · ') || user.phone}</p>
            </div>
            <Link href="/portal/privacy" className="hidden text-sm font-medium text-muted-ink hover:text-ink md:inline">My data</Link>
            <form action={portalSignOutAction}>
              <button type="submit" className="flex size-10 items-center justify-center rounded-full text-muted-ink hover:bg-surface hover:text-ink" aria-label="Sign out"><LogOut className="size-5" /></button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 md:py-8">{children}</main>
      <PortalBottomBar />
    </div>
  )
}
