'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, Menu, MessageCircle, Phone } from 'lucide-react'
import { cn } from 'cn'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { EnquiryLink } from '@/components/marketing/enquiry-dialog'
import { MAIN_NAV, PRIMARY_CTA, SECONDARY_CTA, SERVICE_NAV, SITE, whatsappHref } from '@/lib/constants/site'

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`)

export function SiteHeader() {
  const pathname = usePathname()
  const servicesActive = pathname.startsWith('/services')

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-white/95 backdrop-blur supports-backdrop-filter:bg-white/85">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:h-[72px] lg:px-8">
        <Link href="/" className="shrink-0 rounded-sm" aria-label="REDUX — Bath Restorations by Eurobrass, home">
          <Logo withTagline className="hidden sm:inline-flex" />
          <Logo className="sm:hidden" />
        </Link>

        <nav aria-label="Main" className="ml-4 hidden items-center gap-1 lg:flex">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              className={cn(
                'inline-flex h-10 items-center gap-1 rounded-md px-3 text-sm font-medium transition-colors hover:bg-surface hover:text-redux-blue data-[state=open]:bg-surface',
                servicesActive ? 'text-redux-blue' : 'text-ink',
              )}
            >
              Services <ChevronDown className="size-4 opacity-70" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-80 p-2">
              {SERVICE_NAV.map((s, i) => (
                <DropdownMenuItem key={s.href} asChild className="cursor-pointer rounded-md p-3">
                  <Link href={s.href} className="flex items-start gap-3">
                    <span className="num mt-0.5 text-xs font-semibold text-faint">0{i + 1}</span>
                    <span>
                      <span className="block text-sm font-semibold text-ink">{s.label}</span>
                      <span className="block text-[13px] text-muted-ink">{s.description}</span>
                    </span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {MAIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? 'page' : undefined}
              className={cn(
                'inline-flex h-10 items-center rounded-md px-3 text-sm font-medium transition-colors hover:bg-surface hover:text-redux-blue',
                isActive(pathname, item.href) ? 'text-redux-blue' : 'text-ink',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" className="hidden xl:inline-flex">
            <EnquiryLink kind="dealer">{SECONDARY_CTA}</EnquiryLink>
          </Button>
          <Button asChild className="hidden sm:inline-flex">
            <EnquiryLink>{PRIMARY_CTA}</EnquiryLink>
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[88vw] gap-0 overflow-y-auto p-0 sm:max-w-sm">
              <div className="border-b border-line px-5 py-4">
                <SheetTitle asChild>
                  <span>
                    <Logo withTagline />
                  </span>
                </SheetTitle>
                <SheetDescription className="sr-only">Site navigation</SheetDescription>
              </div>
              <nav aria-label="Mobile" className="px-3 py-4">
                <p className="eyebrow px-2 pb-1 text-faint">Services</p>
                {SERVICE_NAV.map((s) => (
                  <MobileLink key={s.href} href={s.href} active={isActive(pathname, s.href)}>
                    {s.label}
                  </MobileLink>
                ))}
                <p className="eyebrow px-2 pt-4 pb-1 text-faint">REDUX</p>
                {MAIN_NAV.map((s) => (
                  <MobileLink key={s.href} href={s.href} active={isActive(pathname, s.href)}>
                    {s.label}
                  </MobileLink>
                ))}
                <MobileLink href="/dealers" active={isActive(pathname, '/dealers')}>
                  For dealers
                </MobileLink>
                <MobileLink href="/contact" active={isActive(pathname, '/contact')}>
                  Contact
                </MobileLink>
              </nav>
              <div className="mt-auto space-y-2 border-t border-line p-5">
                <SheetClose asChild>
                  <Button asChild size="lg" className="w-full">
                    <EnquiryLink>{PRIMARY_CTA}</EnquiryLink>
                  </Button>
                </SheetClose>
                <Button asChild size="lg" variant="whatsapp" className="w-full">
                  <a href={whatsappHref(pathname)} target="_blank" rel="noopener noreferrer">
                    <MessageCircle aria-hidden /> Message us on WhatsApp
                  </a>
                </Button>
                <a href={`tel:${SITE.phoneE164}`} className="flex items-center justify-center gap-2 pt-1 text-sm font-medium text-redux-blue">
                  <Phone className="size-4" aria-hidden /> <span className="num">{SITE.phoneDisplay}</span>
                </a>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}

function MobileLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <SheetClose asChild>
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex h-11 items-center rounded-md px-2 text-[15px] font-medium',
          active ? 'bg-select text-redux-blue' : 'text-ink hover:bg-surface',
        )}
      >
        {children}
      </Link>
    </SheetClose>
  )
}
