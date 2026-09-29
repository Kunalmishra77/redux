import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/components/marketing/legal-page'
import { SITE, pageMetadata } from '@/lib/constants/site'

// A15 — Terms of Service. Required for Razorpay KYC. Working draft for REDUX's legal review.

export const metadata: Metadata = pageMetadata({
  title: 'Terms of Service',
  description: 'The terms on which REDUX — Bath Restorations by Eurobrass — provides assessments, quotations and restoration work.',
  path: '/terms',
})

const TOC = [
  { id: 'about', label: 'About these terms' },
  { id: 'assessment', label: 'The free assessment' },
  { id: 'quotation', label: 'Quotations' },
  { id: 'work', label: 'Carrying out the work' },
  { id: 'payment', label: 'Payment' },
  { id: 'warranty', label: 'Warranty' },
  { id: 'liability', label: 'Liability' },
  { id: 'law', label: 'Governing law' },
  { id: 'contact', label: 'Contact' },
]

export default function TermsPage() {
  return (
    <LegalPage
      path="/terms"
      crumb="Terms"
      title="Terms of Service"
      intro="The terms on which REDUX assesses, quotes for and restores bathroom fittings."
      updated="September 2026"
      toc={TOC}
    >
      <h2 id="about">About these terms</h2>
      <p>
        REDUX — Bath Restorations by Eurobrass (&ldquo;REDUX&rdquo;, &ldquo;we&rdquo;) provides the assessment, repair and
        restoration of bathroom fittings, from {SITE.address.line1}, {SITE.address.locality} {SITE.address.postalCode}.
        These terms apply to every assessment, quotation and job. The quotation you approve forms part of your contract
        with us.
      </p>

      <h2 id="assessment">The free assessment</h2>
      <p>
        The assessment is free and carries no obligation. Our surveyor records each fitting&apos;s type, brand, model,
        finish and condition, and photographs it from four angles. These records and photographs are used to prepare your
        quotation.
      </p>

      <h2 id="quotation">Quotations</h2>
      <ul>
        <li>
          A quotation gives, for each assessed fitting, the price to restore it, to replace it with a Eurobrass fitting, or to
          replace it at market price.
        </li>
        <li>Each quotation states its validity period. Prices are those of the rate card in force on the quotation date.</li>
        <li>
          Available repairs and finishes depend on the condition of each fitting. If a fitting proves unsuitable once
          removed, we will tell you before doing any further work on it.
        </li>
        <li>An approved quotation is not changed afterwards; any change in scope is issued as a new version for approval.</li>
      </ul>

      <h2 id="work">Carrying out the work</h2>
      <ul>
        <li>Work dates, room availability, access and downtime are agreed with you before work begins.</li>
        <li>
          Any civil work — walls or tiles — is carried out by your own maintenance panel, as agreed with REDUX in advance.
          Delays caused while a unit waits on such work are not counted against REDUX&apos;s schedule.
        </li>
        <li>Each fitting is checked for leaks, tested for operation and inspected for finish before handover.</li>
      </ul>

      <h2 id="payment">Payment</h2>
      <p>
        Payment terms, including any advance, are stated in your quotation. Invoices are issued under GST. Payments can be
        made through the payment link or bank transfer details shown on the invoice. See our{' '}
        <Link href="/refunds">Refund &amp; Cancellation Policy</Link>.
      </p>

      <h2 id="warranty">Warranty</h2>
      <p>
        Mechanical work and restored finishes carry separate warranty periods, stated in your quotation. Warranty cards are
        issued at handover and are visible in your REDUX customer portal. The warranty does not cover damage from untreated
        hard-water scaling, abrasive cleaners or work by third parties.
      </p>

      <h2 id="liability">Liability</h2>
      <p>
        Nothing in these terms limits your rights under the Consumer Protection Act, 2019. Subject to that, our liability
        for any job is limited to the value of that job.
      </p>

      <h2 id="law">Governing law</h2>
      <p>These terms are governed by the laws of India. The courts at New Delhi have jurisdiction.</p>

      <h2 id="contact">Contact</h2>
      <p>
        Questions about these terms: <a href={`mailto:${SITE.email}`}>{SITE.email}</a> · {SITE.phoneDisplay}. Complaints:
        our Grievance Officer, <a href={`mailto:${SITE.grievance.email}`}>{SITE.grievance.email}</a>.
      </p>
    </LegalPage>
  )
}
