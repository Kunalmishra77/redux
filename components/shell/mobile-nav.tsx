'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Logo } from '@/components/brand/logo'
import { Sidebar } from './sidebar'
import type { AppRole } from '@/lib/auth/session'

// Below md the sidebar is hidden; the same navigation opens from the topbar. A tap on any link
// closes the sheet (the click bubbles up to the nav wrapper).
export function MobileNav({ role, roleLabel }: { role: Exclude<AppRole, 'customer'>; roleLabel: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu"><Menu className="size-5" /></Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 border-0 bg-redux-blue p-0 py-5 text-white">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <SheetDescription className="sr-only">{roleLabel} navigation</SheetDescription>
        <Link href="/staff" className="mb-8 px-6" onClick={() => setOpen(false)}><Logo tone="white" /></Link>
        <div onClick={(e) => { if ((e.target as HTMLElement).closest('a')) setOpen(false) }}>
          <Sidebar role={role} />
        </div>
        <p className="mt-auto px-6 text-[11px] text-pale"><span className="block font-semibold text-white">REDUX workspace</span>{roleLabel} view</p>
      </SheetContent>
    </Sheet>
  )
}
