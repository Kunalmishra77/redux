import type { Metadata } from 'next'
import { CheckCircle2 } from 'lucide-react'
import { Breadcrumbs, Container } from '@/components/marketing/sections'
import { RegisterForm } from '@/components/marketing/register-form'
import { getEnquiryContext, getSegments } from '@/lib/data/website'
import { pageMetadata } from '@/lib/constants/site'

export const metadata: Metadata = pageMetadata({
  title: 'Create a business account',
  description: 'One account for your property or business: assessments, proposals, work progress, invoices, warranty cards and service — every visit in one history.',
  path: '/register',
})

const BENEFITS = [
  'Every assessment, proposal and job in one history',
  'Approve proposals and pay invoices online',
  'Warranty cards and completion reports, always to hand',
  'Request the same work again in a click',
  'Add your engineering and accounts colleagues',
]

// CR-001 phase 2 (E19, D25) — business registration (BR-B2: open, verified by REDUX).
export default async function RegisterPage() {
  const [{ cities, notice }, segments] = await Promise.all([getEnquiryContext(), getSegments()])
  return (
    <div className="bg-surface">
      <Container className="py-10 sm:py-14">
        <Breadcrumbs items={[{ name: 'Create a business account', href: '/register' }]} tone="white" />
        <div className="mt-6 grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:gap-14">
          <div className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-8">
            <p className="eyebrow text-redux-blue">For hotels and businesses</p>
            <h1 className="mt-2 text-[30px] leading-tight font-semibold tracking-tight text-ink sm:text-4xl">Create a business account</h1>
            <p className="mt-3 text-base leading-relaxed text-muted-ink">It takes two minutes. You can start an enquiry straight away; our team verifies the account and then your complete history and reports open up.</p>
            <RegisterForm segments={segments} cities={cities} noticeVersion={notice?.version ?? null} />
          </div>
          <aside className="space-y-4 lg:pt-4">
            <h2 className="text-lg font-semibold text-ink">What your account gives you</h2>
            <ul className="space-y-3">
              {BENEFITS.map((b) => <li key={b} className="flex gap-3 text-[15px] text-ink"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />{b}</li>)}
            </ul>
          </aside>
        </div>
      </Container>
    </div>
  )
}
