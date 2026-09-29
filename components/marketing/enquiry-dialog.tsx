'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { EnquiryForm } from '@/components/marketing/enquiry-form'
import type { EnquirerKind } from '@/lib/validators/enquiry'

// A13: "Also opens as a modal from every CTA, so it must work in both contexts." Every CTA is a real
// link to /book-assessment (works without JavaScript, crawlable, opens in a new tab); a plain click
// opens the same form in a dialog instead.

type Ctx = {
  cities: { id: string; name: string }[]
  noticeVersion: string | null
  open: (kind?: EnquirerKind) => void
}

const EnquiryContext = React.createContext<Ctx | null>(null)

export function EnquiryProvider({
  cities,
  noticeVersion,
  children,
}: {
  cities: { id: string; name: string }[]
  noticeVersion: string | null
  children: React.ReactNode
}) {
  const [state, setState] = React.useState<{ open: boolean; kind: EnquirerKind; path: string | null }>({
    open: false,
    kind: 'home',
    path: null,
  })
  const pathname = usePathname()
  // A successful enquiry navigates to /thank-you — the dialog belongs to the page it was opened on
  const isOpen = state.open && state.path === pathname

  const ctx = React.useMemo<Ctx>(
    () => ({ cities, noticeVersion, open: (kind = 'home') => setState({ open: true, kind, path: pathname }) }),
    [cities, noticeVersion, pathname],
  )

  return (
    <EnquiryContext.Provider value={ctx}>
      {children}
      <Dialog open={isOpen} onOpenChange={(o) => setState((s) => ({ ...s, open: o }))}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:max-w-xl sm:p-7">
          <div className="pr-8">
            <p className="eyebrow text-redux-blue">Free · no obligation</p>
            <DialogTitle className="mt-1 text-[22px] leading-tight font-semibold text-ink">
              {state.kind === 'dealer' ? 'Dealer enquiry' : 'Book a free assessment'}
            </DialogTitle>
            <DialogDescription className="mt-1.5 text-sm text-muted-ink">
              Tell us about the fittings. We&apos;ll call within 2 working hours to arrange a visit.
            </DialogDescription>
          </div>
          <EnquiryForm key={state.kind} cities={cities} noticeVersion={noticeVersion} defaultKind={state.kind} />
        </DialogContent>
      </Dialog>
    </EnquiryContext.Provider>
  )
}

/** A CTA that is a link everywhere and a dialog trigger where the provider exists. */
export function EnquiryLink({
  kind = 'home',
  className,
  children,
  ...rest
}: Omit<React.ComponentProps<typeof Link>, 'href'> & { kind?: EnquirerKind }) {
  const ctx = React.useContext(EnquiryContext)
  const href = kind === 'dealer' ? '/dealer-enquiry' : '/book-assessment'
  return (
    <Link
      href={href}
      className={className}
      {...rest}
      onClick={(e) => {
        rest.onClick?.(e)
        if (!ctx || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
        e.preventDefault()
        ctx.open(kind)
      }}
    >
      {children}
    </Link>
  )
}
