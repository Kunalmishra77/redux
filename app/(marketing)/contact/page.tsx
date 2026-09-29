import type { Metadata } from 'next'
import { Clock, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react'
import { IconCircle } from '@/components/patterns'
import { Button } from '@/components/ui/button'
import { EnquiryForm } from '@/components/marketing/enquiry-form'
import { WhatsAppGlyph } from '@/components/marketing/floating-actions'
import { PageHero, Section } from '@/components/marketing/sections'
import { getEnquiryContext } from '@/lib/data/website'
import { SITE, pageMetadata, whatsappHref } from '@/lib/constants/site'

// A12 — Contact. Required for Razorpay KYC: address, phone, email and the grievance officer, matching
// the footer exactly (NAP consistency, SEO plan §5).

export const metadata: Metadata = pageMetadata({
  title: 'Contact REDUX',
  description: `Contact REDUX — Bath Restorations by Eurobrass. ${SITE.address.line1}, ${SITE.address.locality} ${SITE.address.postalCode}. Call, email or message us on WhatsApp.`,
  path: '/contact',
})

export default async function ContactPage() {
  const { cities, notice } = await getEnquiryContext()
  const rows = [
    {
      icon: MapPin,
      label: 'Address',
      value: (
        <address className="not-italic">
          {SITE.address.line1}
          <br />
          {SITE.address.locality} {SITE.address.postalCode}, {SITE.address.country}
        </address>
      ),
    },
    {
      icon: Phone,
      label: 'Phone',
      value: (
        <a href={`tel:${SITE.phoneE164}`} className="num font-medium text-redux-blue hover:underline">
          {SITE.phoneDisplay}
        </a>
      ),
    },
    {
      icon: Mail,
      label: 'Email',
      value: (
        <a href={`mailto:${SITE.email}`} className="font-medium text-redux-blue hover:underline">
          {SITE.email}
        </a>
      ),
    },
    { icon: Clock, label: 'Hours', value: SITE.hours },
  ]

  return (
    <>
      <PageHero
        breadcrumbs={[{ name: 'Contact', href: '/contact' }]}
        eyebrow="Contact"
        title="Talk to REDUX."
        intro="Call, email or message us on WhatsApp — or send an enquiry and we'll call you within 2 working hours."
        actions={
          <div className="mt-8">
            <Button asChild size="lg" variant="whatsapp" className="text-base">
              <a href={whatsappHref('/contact')} target="_blank" rel="noopener noreferrer">
                <WhatsAppGlyph className="size-5" /> Message us on WhatsApp
              </a>
            </Button>
          </div>
        }
      />

      <Section labelledBy="contact-details">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
          <div className="space-y-8">
            <div>
              <h2 id="contact-details" className="text-2xl font-semibold tracking-tight text-ink">
                REDUX — Bath Restorations by Eurobrass
              </h2>
              <dl className="mt-6 space-y-5">
                {rows.map(({ icon, label, value }) => (
                  <div key={label} className="flex gap-4">
                    <IconCircle icon={icon} />
                    <div className="text-[15px] text-ink">
                      <dt className="eyebrow text-muted-ink">{label}</dt>
                      <dd className="mt-1">{value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </div>

            <section aria-labelledby="grievance-officer" className="rounded-xl border border-line bg-surface p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-redux-blue" aria-hidden />
                <div className="text-[15px]">
                  <h2 id="grievance-officer" className="font-semibold text-ink">
                    Grievance Officer
                  </h2>
                  <p className="mt-1 text-ink">{SITE.grievance.name}</p>
                  <p className="text-ink">
                    <a href={`mailto:${SITE.grievance.email}`} className="text-redux-blue hover:underline">
                      {SITE.grievance.email}
                    </a>{' '}
                    · <span className="num">{SITE.grievance.phoneDisplay}</span>
                  </p>
                  <p className="mt-2 text-sm text-muted-ink">
                    We acknowledge complaints within 48 hours and aim to resolve within 30 days.
                  </p>
                </div>
              </div>
            </section>

            <p className="text-sm text-muted-ink">Service areas: {SITE.serviceAreas.join(' · ')}.</p>
          </div>

          <div className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-8">
            <h2 className="text-xl font-semibold text-ink">Send an enquiry</h2>
            <p className="mt-1 mb-6 text-sm text-muted-ink">We&apos;ll call you within 2 working hours.</p>
            <EnquiryForm cities={cities} noticeVersion={notice?.version ?? null} />
          </div>
        </div>
      </Section>
    </>
  )
}
