import type { Metadata } from 'next'
import { LegalPage } from '@/components/marketing/legal-page'
import { SITE, pageMetadata } from '@/lib/constants/site'

// A17 — Refund & Cancellation. Required for Razorpay KYC. Working draft for REDUX's legal review.
// Amounts and periods specific to a job are stated in its quotation — never on this page.

export const metadata: Metadata = pageMetadata({
  title: 'Refund and Cancellation Policy',
  description: 'How cancellations and refunds work for REDUX assessments, quotations and restoration work.',
  path: '/refunds',
})

const TOC = [
  { id: 'assessment', label: 'The free assessment' },
  { id: 'before', label: 'Cancelling before work begins' },
  { id: 'after', label: 'After fittings are removed' },
  { id: 'refunds', label: 'How refunds are paid' },
  { id: 'warranty', label: 'Warranty claims' },
  { id: 'contact', label: 'Contact' },
]

export default function RefundsPage() {
  return (
    <LegalPage
      path="/refunds"
      crumb="Refund & Cancellation"
      title="Refund & Cancellation Policy"
      intro="What happens if you cancel, and how refunds are made."
      updated="September 2026"
      toc={TOC}
    >
      <h2 id="assessment">The free assessment</h2>
      <p>
        The assessment is free. You can cancel or reschedule it at any time by calling or messaging us — there is nothing to
        refund.
      </p>

      <h2 id="before">Cancelling before work begins</h2>
      <p>
        If you cancel an approved quotation before any fitting has been removed, any advance you have paid is refunded in
        full.
      </p>

      <h2 id="after">After fittings are removed</h2>
      <p>
        Once fittings have been removed for restoration, work on them has begun. If you cancel at this stage, we will refit
        the fittings and charge only for work already carried out and parts already made for your fittings, as itemised on
        your quotation. Any balance of your advance is refunded.
      </p>

      <h2 id="refunds">How refunds are paid</h2>
      <ul>
        <li>Refunds are made to the original payment method, or by bank transfer for payments made that way.</li>
        <li>Where an invoice has been issued, the refund is recorded with a GST credit note.</li>
        <li>We start the refund when the cancellation is confirmed; your bank&apos;s processing time then applies.</li>
      </ul>

      <h2 id="warranty">Warranty claims</h2>
      <p>
        A fault covered by warranty is put right by repair or restoration at no charge. Raise it through the customer portal,
        by phone or on WhatsApp.
      </p>

      <h2 id="contact">Contact</h2>
      <p>
        To cancel or ask about a refund: <a href={`mailto:${SITE.email}`}>{SITE.email}</a> · {SITE.phoneDisplay}.
        Complaints: our Grievance Officer, <a href={`mailto:${SITE.grievance.email}`}>{SITE.grievance.email}</a>. We
        acknowledge complaints within 48 hours and aim to resolve within 30 days.
      </p>
    </LegalPage>
  )
}
