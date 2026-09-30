'use client'

import Link from 'next/link'
import { Bell, LogOut, Search, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatRelative } from '@/components/patterns'
import { signOut } from '@/app/staff/login/actions'
import type { AppRole } from '@/lib/auth/session'
import { MobileNav } from './mobile-nav'

export type Alert = { id: string; title: string; body: string | null; href: string | null; at: string; read: boolean }

export function Topbar({ role, name, roleLabel, alerts, searchable }: {
  role: Exclude<AppRole, 'customer'>
  name: string
  roleLabel: string
  alerts: Alert[]
  searchable: boolean
}) {
  const unread = alerts.filter((a) => !a.read).length
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-white/95 px-3 backdrop-blur sm:gap-4 sm:px-6">
      <MobileNav role={role} roleLabel={roleLabel} />
      {searchable ? (
        <form action="/staff/leads" className="relative w-full max-w-md" role="search">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <label htmlFor="global-search" className="sr-only">Search leads by name, phone or property</label>
          <input id="global-search" name="q" placeholder="Search leads — name, phone, property"
            className="h-10 w-full rounded-md border border-line bg-surface pr-3 pl-9 text-sm outline-none placeholder:text-faint focus:border-redux-blue focus:bg-white" />
        </form>
      ) : <div className="flex-1" />}

      <div className="ml-auto flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Alerts${unread ? `, ${unread} unread` : ''}`} className="relative">
              <Bell className="size-5" aria-hidden />
              {unread > 0 && (
                <span className="num absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-4 font-semibold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(24rem,calc(100vw-1.5rem))] p-0">
            <div className="border-b border-line px-4 py-3">
              <p className="text-sm font-semibold text-ink">Alerts</p>
              <p className="text-xs text-muted-ink">{unread ? `${unread} need your attention` : 'You’re all caught up'}</p>
            </div>
            <ul className="max-h-96 overflow-y-auto">
              {alerts.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-ink">New leads, breached SLAs and approvals will appear here.</li>}
              {alerts.map((a) => (
                <li key={a.id} className="border-b border-line last:border-0">
                  <Link href={a.href ?? '#'} className="flex gap-3 px-4 py-3 hover:bg-surface">
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${a.read ? 'bg-transparent' : 'bg-redux-blue'}`} aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink">{a.title}</span>
                      {a.body && <span className="block truncate text-xs text-muted-ink">{a.body}</span>}
                      <span className="block text-[11px] text-faint">{formatRelative(a.at)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 rounded-md py-1 pr-2 pl-1 hover:bg-surface" aria-label="Account menu">
              <span className="flex size-9 items-center justify-center rounded-full bg-redux-blue text-xs font-semibold text-white">{initials}</span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-sm font-semibold text-ink">{name}</span>
                <span className="block text-xs text-muted-ink">{roleLabel}</span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <span className="block text-sm font-semibold">{name}</span>
              <span className="block text-xs text-muted-ink">{roleLabel}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link href="/staff/me"><UserRound aria-hidden /> My profile</Link></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => { void signOut() }}><LogOut aria-hidden /> Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
