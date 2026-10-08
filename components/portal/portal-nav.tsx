'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { History, Home, LifeBuoy, Receipt, ShieldCheck } from 'lucide-react'
import { cn } from 'cn'

export const PORTAL_NAV = [
  { href: '/portal', label: 'Home', icon: Home, exact: true },
  { href: '/portal/history', label: 'History', icon: History, match: ['/portal/history', '/portal/fittings', '/portal/reports'] },
  { href: '/portal/invoices', label: 'Invoices', icon: Receipt },
  { href: '/portal/warranty', label: 'Warranty', icon: ShieldCheck },
  { href: '/portal/service-requests', label: 'Help', icon: LifeBuoy },
]

type Item = (typeof PORTAL_NAV)[number] & { match?: string[] }
const active = (path: string, n: Item) => (n.exact ? path === n.href : (n.match ?? [n.href]).some((h) => path === h || path.startsWith(`${h}/`)))

/** Desktop: a row of tabs in the header. */
export function PortalTabs() {
  const path = usePathname()
  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="Portal">
      {PORTAL_NAV.map((n) => (
        <Link key={n.href} href={n.href} className={cn('rounded-md px-3 py-2 text-sm font-medium transition', active(path, n as Item) ? 'bg-select text-redux-blue' : 'text-muted-ink hover:text-ink')}>{n.label}</Link>
      ))}
    </nav>
  )
}

/** Phone: a bottom bar with big targets — customers are usually on a phone. */
export function PortalBottomBar() {
  const path = usePathname()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Portal">
      {PORTAL_NAV.map((n) => {
        const on = active(path, n as Item)
        return (
          <Link key={n.href} href={n.href} className={cn('flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium', on ? 'text-redux-blue' : 'text-muted-ink')}>
            <n.icon className="size-5" aria-hidden />{n.label}
          </Link>
        )
      })}
    </nav>
  )
}
