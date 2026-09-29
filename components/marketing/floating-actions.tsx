'use client'

import { usePathname } from 'next/navigation'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { EnquiryLink } from '@/components/marketing/enquiry-dialog'
import { PRIMARY_CTA, whatsappHref } from '@/lib/constants/site'

// Global (screen spec A1): a floating WhatsApp button whose pre-filled message names the page it
// came from (E2-S11), and a sticky "Book free assessment" on mobile.
const NO_STICKY_CTA = ['/book-assessment', '/dealer-enquiry', '/thank-you']

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.42.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.93.95-3.48-.22-.36a9.37 9.37 0 0 1-1.44-5c0-5.19 4.23-9.42 9.43-9.42a9.36 9.36 0 0 1 6.66 2.76 9.36 9.36 0 0 1 2.76 6.67c0 5.2-4.23 9.42-9.42 9.42m8.02-17.44A11.27 11.27 0 0 0 12.05.75C5.8.75.71 5.84.71 12.09c0 2 .52 3.95 1.52 5.66L.62 23.63l6.02-1.58a11.3 11.3 0 0 0 5.4 1.38h.01c6.25 0 11.34-5.09 11.34-11.34 0-3.03-1.18-5.88-3.32-8.02" />
    </svg>
  )
}

export function FloatingActions() {
  const pathname = usePathname()
  const href = whatsappHref(pathname)
  const showBar = !NO_STICKY_CTA.includes(pathname)

  return (
    <>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Message us on WhatsApp"
        className={cn(
          'group fixed right-5 bottom-5 z-40 items-center gap-2 rounded-full bg-whatsapp p-3.5 text-ink shadow-card transition-transform hover:scale-105 lg:right-8 lg:bottom-8 lg:py-3 lg:pr-5 lg:pl-4',
          showBar ? 'hidden sm:flex' : 'flex',
        )}
      >
        <WhatsAppGlyph className="size-6" />
        <span className="hidden text-sm font-semibold lg:inline">Message us on WhatsApp</span>
      </a>

      {showBar && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-line bg-white/95 p-3 backdrop-blur sm:hidden">
          <Button asChild size="lg" className="flex-1">
            <EnquiryLink>{PRIMARY_CTA}</EnquiryLink>
          </Button>
          <Button asChild size="icon-lg" variant="whatsapp" aria-label="Message us on WhatsApp">
            <a href={href} target="_blank" rel="noopener noreferrer">
              <WhatsAppGlyph className="size-6" />
            </a>
          </Button>
        </div>
      )}
    </>
  )
}

export { WhatsAppGlyph }
