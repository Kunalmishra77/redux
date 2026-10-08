import type { Metadata } from 'next'
import { EnquiryPage } from '@/components/marketing/enquiry-page'
import { pageMetadata } from '@/lib/constants/site'

// A13 — Book free assessment. Also opens as a dialog from every CTA (components/marketing/enquiry-dialog).
export const metadata: Metadata = pageMetadata({
  title: 'Book a free assessment',
  description:
    'Book a free, no-obligation assessment of the bathroom fittings in your hotel or building. We call within 2 working hours to arrange it.',
  path: '/book-assessment',
})

export default function BookAssessmentPage() {
  return (
    <EnquiryPage
      kind="hotel"
      path="/book-assessment"
      crumb="Book free assessment"
      eyebrow="Free · no obligation"
      title="Book a free assessment"
      intro="Tell us about the fittings. One of our team will call you within 2 working hours to arrange a visit."
    />
  )
}
