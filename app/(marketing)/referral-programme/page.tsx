import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2, Gift, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CtaBand, NumberedCard, PageHero, Section, SectionHeading, Steps } from '@/components/marketing/sections'
import { getProgrammes } from '@/lib/data/catalog'
import { pageMetadata } from '@/lib/constants/site'

export const metadata: Metadata = pageMetadata({
  title: 'Referral programme — for REDUX customers',
  description: 'Refer another hotel or business to REDUX: they get a discount on their first order, and you earn credit when they pay — plus a free fitting for every few that order.',
  path: '/referral-programme',
})

// CR-001 phase 8 (D31) — the referral programme (BR-R2, BR-R3, BR-R4). Numbers from settings.
export default async function ReferralProgrammePage() {
  const { referral: r } = await getProgrammes()
  return (
    <>
      <PageHero breadcrumbs={[{ name: 'Referral programme', href: '/referral-programme' }]} eyebrow="For REDUX customers"
        title="Know a hotel that should restore, not replace?"
        intro={`They get ${r.referred_discount_pct}% off their first order. You earn ${r.referrer_credit_pct}% of that order as credit once they pay${r.free_fitting_every > 0 ? `, and one fitting restored free for every ${r.free_fitting_every} businesses that order` : ''}.`}
        actions={<div className="mt-8"><Button asChild size="lg" className="text-base"><Link href="/portal/referrals">Get my referral link</Link></Button></div>} />
      <Section labelledBy="how">
        <SectionHeading id="how" eyebrow="How it works" title="Share a link. We do the rest." />
        <div className="mt-12">
          <Steps steps={[
            { title: 'Share your link', body: 'Your code and link are in your REDUX portal, ready to send on WhatsApp.' },
            { title: 'They register or enquire', body: 'Through your link, or by giving your code. Their first order is discounted automatically.' },
            { title: 'You earn when they pay', body: `Credit of ${r.referrer_credit_pct}% of their first order, applied to your next invoice. Valid for ${Math.round(r.reward_validity_days / 30)} months.` },
          ]} />
        </div>
      </Section>
      <Section tone="surface" labelledBy="rules">
        <SectionHeading id="rules" eyebrow="The fine print, plainly" title="Simple rules." />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <NumberedCard n="01" icon={Building2} title="Your own group counts" body="Branches of the same hotel group can refer each other. An account cannot refer itself." />
          <NumberedCard n="02" icon={Gift} title="One benefit at a time" body="If another offer is running, the referred business gets whichever discount is larger — not both." />
          {r.free_fitting_every > 0 && <NumberedCard n="03" icon={Wrench} title="Free fittings add up" body={`Every ${r.free_fitting_every} referred businesses that order earn you one fitting restored free.`} />}
        </div>
      </Section>
      <CtaBand title="Not a REDUX customer yet?" body="Create a business account, start with a free assessment, and the programme is yours too." />
    </>
  )
}
