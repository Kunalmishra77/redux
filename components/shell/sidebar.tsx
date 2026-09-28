'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from 'cn'
import type { NavItem } from './nav'

// Nav items carry icon components, which can't cross the server→client boundary; the server
// passes the role and this component looks the items up.
import { NAV } from './nav'
import type { AppRole } from '@/lib/auth/session'

function isActive(item: NavItem, path: string) {
  if (item.match) return new RegExp(item.match).test(path)
  return path === item.href || path.startsWith(`${item.href}/`)
}

export function Sidebar({ role }: { role: Exclude<AppRole, 'customer'> }) {
  const path = usePathname()
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5 px-3">
      {NAV[role].map((item) => {
        const active = isActive(item, path)
        const Icon = item.icon
        return (
          <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}
            className={cn('flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
              active ? 'bg-white text-redux-blue shadow-card' : 'text-pale hover:bg-white/10 hover:text-white')}>
            <Icon className="size-[18px] shrink-0" aria-hidden />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
