import type { Metadata } from 'next'
import { EnquiryPage } from '@/components/marketing/enquiry-page'
import { pageMetadata } from '@/lib/constants/site'

// A14 — Dealer enquiry. Lead source `dealer` (BR-L2).
export const metadata: Metadata = pageMetadata({
  title: 'Dealer enquiry',
  description: 'Send REDUX an enquiry for your client’s fittings and we’ll handle the assessment.',
  path: '/dealer-enquiry',
})

export default function DealerEnquiryPage() {
  return (
    <EnquiryPage
      kind="dealer"
      path="/dealer-enquiry"
      crumb="Dealer enquiry"
      eyebrow="For dealers"
      title="Dealer enquiry"
      intro="Send us the enquiry and we'll handle the assessment. Tell us about your firm and your client's fittings."
    />
  )
}
