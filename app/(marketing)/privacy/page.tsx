import type { Metadata } from 'next'
import { LegalPage } from '@/components/marketing/legal-page'
import { formatWhen } from '@/components/patterns'
import { getEnquiryContext } from '@/lib/data/website'
import { SITE, pageMetadata } from '@/lib/constants/site'

// A16 — Privacy Policy + DPDP notice. Must carry: what data, what purpose, how to withdraw, how to
// complain, grievance officer contact, and the notice in Eighth Schedule languages on request.
// BR-P1: the notice text shown here is the ACTIVE row in privacy_notices — the same version every
// enquiry form records consent against.

export const metadata: Metadata = pageMetadata({
  title: 'Privacy Policy and DPDP notice',
  description:
    'How REDUX collects and uses your personal data, your rights under the Digital Personal Data Protection Act 2023, and how to withdraw consent or raise a grievance.',
  path: '/privacy',
})

const TOC = [
  { id: 'notice', label: 'Privacy notice' },
  { id: 'data', label: 'What we collect' },
  { id: 'purpose', label: 'Why we use it' },
  { id: 'consent', label: 'Consent and withdrawal' },
  { id: 'retention', label: 'How long we keep it' },
  { id: 'sharing', label: 'Who we share it with' },
  { id: 'rights', label: 'Your rights' },
  { id: 'grievance', label: 'Grievances and complaints' },
  { id: 'languages', label: 'Other languages' },
]

export default async function PrivacyPage() {
  const { notice } = await getEnquiryContext()

  return (
    <LegalPage
      path="/privacy"
      crumb="Privacy Policy"
      title="Privacy Policy"
      intro="How REDUX — Bath Restorations by Eurobrass — handles your personal data, under the Digital Personal Data Protection Act, 2023."
      updated={notice ? formatWhen(notice.effectiveFrom, false) : '2026'}
      toc={TOC}
    >
      <h2 id="notice">Privacy notice</h2>
      <div className="mt-4 rounded-xl border border-line bg-surface p-5">
        <p className="!mt-0 text-sm font-semibold text-redux-blue">
          {notice ? `Notice version ${notice.version} · effective ${formatWhen(notice.effectiveFrom, false)}` : 'Privacy notice'}
        </p>
        <p className="text-[15px]">
          {notice?.body ??
            'REDUX collects your name, phone number and property details to arrange and deliver your free assessment, quotation and restoration work. Marketing messages are sent only if you opt in, and you can withdraw at any time.'}
        </p>
      </div>
      <p>
        This is the notice shown next to every enquiry form on this website. When you submit an enquiry, we record your
        consent against this notice version, so there is always a record of exactly what you were told.
      </p>

      <h2 id="data">What we collect</h2>
      <ul>
        <li>Your name, mobile number and, if you give it, your email address.</li>
        <li>Your city and property details — for hotels, the property name, number of rooms and your role.</li>
        <li>What you tell us about your fittings, and how you reached us (for example, the page or advert you came from).</li>
        <li>
          During an assessment: photographs and records of the fittings at your property. These are used as evidence for
          your quotation and are <strong>not</strong> used in marketing unless you separately agree.
        </li>
        <li>If you make a payment: payment references from our payment provider. We do not store card details.</li>
      </ul>

      <h2 id="purpose">Why we use it</h2>
      <ul>
        <li>To respond to your enquiry and arrange your free assessment.</li>
        <li>To prepare your quotation, carry out the work, issue invoices and warranty cards.</li>
        <li>To send service messages about your enquiry, visit, work and warranty — by phone, SMS or WhatsApp.</li>
        <li>To send occasional updates about REDUX services — only if you have opted in.</li>
      </ul>

      <h2 id="consent">Consent and withdrawal</h2>
      <p>
        Service contact, marketing and — where applicable — call recording and use of site photographs in marketing are
        separate consents. Each can be withdrawn on its own; withdrawing marketing consent does not stop the service
        messages about work you have asked us to do.
      </p>
      <p>
        To withdraw a consent, use the customer portal, tell the REDUX team member you are speaking to, or write to{' '}
        <a href={`mailto:${SITE.privacyEmail}`}>{SITE.privacyEmail}</a>.
      </p>

      <h2 id="retention">How long we keep it</h2>
      <p>
        We keep enquiry and job records for as long as needed to deliver the work and honour its warranty. Invoices and
        tax records are kept for the period Indian GST law requires. Call recordings, where made, are deleted after 90 days
        unless they are needed for a live dispute. When you ask us to erase your data, we tell you what must be retained and
        why.
      </p>

      <h2 id="sharing">Who we share it with</h2>
      <p>
        We share data only with service providers who help us deliver the service — hosting, messaging, SMS and payment
        providers — under contract, and only for that purpose. We do not sell personal data.
      </p>

      <h2 id="rights">Your rights</h2>
      <ul>
        <li>To ask what personal data we hold about you, and how it is used.</li>
        <li>To correct or complete it.</li>
        <li>To ask us to erase it, subject to the records the law requires us to keep.</li>
        <li>To nominate another person to exercise these rights on your behalf.</li>
      </ul>

      <h2 id="grievance">Grievances and complaints</h2>
      <p>
        <strong>Grievance Officer:</strong> {SITE.grievance.name} ·{' '}
        <a href={`mailto:${SITE.grievance.email}`}>{SITE.grievance.email}</a> · {SITE.grievance.phoneDisplay}
      </p>
      <p>
        We acknowledge complaints within 48 hours and aim to resolve within 30 days. If you are not satisfied with our
        response, you may complain to the Data Protection Board of India.
      </p>

      <h2 id="languages">Other languages</h2>
      <p>
        This notice is available on request in any language listed in the Eighth Schedule to the Constitution of India.
        Write to <a href={`mailto:${SITE.privacyEmail}?subject=Privacy%20notice%20language%20request`}>{SITE.privacyEmail}</a>{' '}
        and tell us the language you would like.
      </p>
    </LegalPage>
  )
}
