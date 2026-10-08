import Link from 'next/link'
import { Mail, MapPin, Phone, ShieldCheck } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { FOOTER_NAV, LEGAL_NAV, SITE, visibleNav } from '@/lib/constants/site'

// Footer copy: 01-website-copy.md § Footer. The grievance-officer block is required by the Consumer
// Protection (E-Commerce) Rules 2020 and Razorpay KYC looks for it — never remove it.
export function SiteFooter({ legalName, b2c = false }: { legalName: string | null; b2c?: boolean }) {
  return (
    <footer className="bg-ink text-pale">
      <div className="mx-auto max-w-7xl px-4 pt-14 pb-28 sm:px-6 lg:px-8 lg:pb-12">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_2fr]">
          <div className="space-y-5">
            <Logo tone="white" withTagline />
            <p className="max-w-sm text-sm leading-relaxed">
              <span className="font-semibold text-white">REDUX — Bath Restorations by Eurobrass.</span> Restoration of
              bathroom fittings — function, finish and water efficiency — backed by 50 years of Eurobrass manufacturing.
            </p>
            <ul className="space-y-2.5 text-sm">
              <li className="flex gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-redux-lime" aria-hidden />
                <address className="not-italic">
                  {SITE.address.line1}, {SITE.address.locality} {SITE.address.postalCode}, {SITE.address.country}
                </address>
              </li>
              <li className="flex gap-2.5">
                <Phone className="mt-0.5 size-4 shrink-0 text-redux-lime" aria-hidden />
                <a href={`tel:${SITE.phoneE164}`} className="num hover:text-white">
                  {SITE.phoneDisplay}
                </a>
              </li>
              <li className="flex gap-2.5">
                <Mail className="mt-0.5 size-4 shrink-0 text-redux-lime" aria-hidden />
                <a href={`mailto:${SITE.email}`} className="hover:text-white">
                  {SITE.email}
                </a>
                <span aria-hidden>·</span>
                <span>reduxbath.com</span>
              </li>
            </ul>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {FOOTER_NAV.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <p className="eyebrow text-white">{col.title}</p>
                <ul className="mt-3 space-y-2 text-sm">
                  {visibleNav(col.items, b2c).map((i) => (
                    <li key={i.href}>
                      <Link href={i.href} className="hover:text-white hover:underline hover:underline-offset-4">
                        {i.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <section aria-labelledby="grievance" className="mt-12 rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-redux-lime" aria-hidden />
            <div className="text-sm">
              <h2 id="grievance" className="font-semibold text-white">
                Grievance Officer
              </h2>
              <p className="mt-1">
                {SITE.grievance.name} ·{' '}
                <a href={`mailto:${SITE.grievance.email}`} className="underline underline-offset-2 hover:text-white">
                  {SITE.grievance.email}
                </a>{' '}
                · <span className="num">{SITE.grievance.phoneDisplay}</span>
              </p>
              <p className="mt-1 text-pale/80">
                We acknowledge complaints within 48 hours and aim to resolve within 30 days.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-6 text-[13px] sm:flex-row sm:items-center sm:justify-between">
          <nav aria-label="Legal">
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {LEGAL_NAV.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} className="hover:text-white hover:underline hover:underline-offset-4">
                    {i.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <p className="text-pale/80">
            © 2026 {legalName ?? 'Eurobrass Industries'}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
