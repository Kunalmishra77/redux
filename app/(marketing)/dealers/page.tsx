import type { Metadata } from 'next'
import { Cog, Handshake, Paintbrush, Send, ClipboardCheck, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EnquiryLink } from '@/components/marketing/enquiry-dialog'
import { CtaBand, NumberedCard, PageHero, Section, SectionHeading, Steps } from '@/components/marketing/sections'
import { SECONDARY_CTA, pageMetadata } from '@/lib/constants/site'

// A7 — For Dealers. Hero copy: 01-website-copy.md § A7, verbatim. A dealer enquiry is lead source
// `dealer` (BR-L2), so the CRM can see which dealers send work.

export const metadata: Metadata = pageMetadata({
  title: 'For dealers — offer restoration alongside replacement',
  description:
    'When a client’s bathroom fitting is discontinued or the finish has gone, offer restoration. REDUX restores function and finish; Eurobrass can re-machine unavailable parts.',
  path: '/dealers',
})

export default function DealersPage() {
  return (
    <>
      <PageHero
        breadcrumbs={[{ name: 'For dealers', href: '/dealers' }]}
        eyebrow="For dealers"
        title="Offer restoration alongside replacement."
        intro="When a client's fitting is discontinued or the finish has gone, replacement isn't the only answer you can give them. REDUX restores function and finish, and Eurobrass can re-machine parts that are no longer available."
        actions={
          <div className="mt-8">
            <p className="text-lg text-white">Send us the enquiry and we&apos;ll handle the assessment.</p>
            <Button asChild size="lg" className="mt-6 text-base">
              <EnquiryLink kind="dealer">{SECONDARY_CTA}</EnquiryLink>
            </Button>
          </div>
        }
      />

      <Section labelledBy="dealer-why">
        <SectionHeading id="dealer-why" eyebrow="Why it helps" title="Another answer for the client you already have." />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <NumberedCard n="01" icon={Cog} title="Discontinued parts" body="Eurobrass can re-machine parts that are no longer available, to match the fitting's requirements." />
          <NumberedCard n="02" icon={Paintbrush} title="Worn finishes" body="Suitable fittings can be recoated in chrome or coloured PVD finishes." />
          <NumberedCard n="03" icon={Handshake} title="Your client relationship" body="You make the introduction. Every dealer enquiry is recorded against your firm." />
        </div>
      </Section>

      <Section tone="surface" labelledBy="dealer-steps">
        <SectionHeading id="dealer-steps" eyebrow="How it works" title="You send the enquiry. We handle the assessment." />
        <div className="mt-12">
          <Steps
            steps={[
              { icon: Send, title: 'Send the enquiry', body: 'Your client’s name, number, city and the fittings in question.' },
              { icon: Users, title: 'We assess', body: 'REDUX calls your client and arranges a free assessment of the fittings.' },
              { icon: ClipboardCheck, title: 'A written scope', body: 'Three prices per fitting — restore, replace with Eurobrass, or replace at market.' },
            ]}
          />
        </div>
      </Section>

      <CtaBand
        title="Have a client with a fitting nobody can fix?"
        body="Send us the enquiry and we'll handle the assessment."
        dealerOnly
      />
    </>
  )
}
