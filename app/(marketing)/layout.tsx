import type { Metadata } from 'next'
import { DemoBar } from '@/components/demo/demo-bar'
import { AttributionCapture } from '@/components/marketing/attribution'
import { EnquiryProvider } from '@/components/marketing/enquiry-dialog'
import { FloatingActions } from '@/components/marketing/floating-actions'
import { SiteFooter } from '@/components/marketing/site-footer'
import { SiteHeader } from '@/components/marketing/site-header'
import { getB2CEnabled, getEnquiryContext, getLegalName } from '@/lib/data/website'
import { SITE } from '@/lib/constants/site'

// D1 — reduxbath.com. Static by default (no cookies/headers read here); the staff app and portal are
// separate route trees and stay per-request.
export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  openGraph: { siteName: SITE.name, locale: 'en_IN', type: 'website' },
  twitter: { card: 'summary' },
}

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [{ cities, notice }, legalName, b2c] = await Promise.all([getEnquiryContext(), getLegalName(), getB2CEnabled()])

  return (
    <EnquiryProvider cities={cities} noticeVersion={notice?.version ?? null} b2c={b2c}>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-redux-lime px-4 py-2 font-semibold text-redux-blue focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <DemoBar />
      <SiteHeader />
      <main id="main" className="min-h-[60vh]">
        {children}
      </main>
      <SiteFooter legalName={legalName} b2c={b2c} />
      <FloatingActions />
      <AttributionCapture />
    </EnquiryProvider>
  )
}
