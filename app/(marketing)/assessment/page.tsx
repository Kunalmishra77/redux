import type { Metadata } from 'next'
import Link from 'next/link'
import { Camera, MapPin, Video } from 'lucide-react'
import { CtaBand, NumberedCard, PageHero, Section, SectionHeading, Steps } from '@/components/marketing/sections'
import { getProgrammes } from '@/lib/data/catalog'
import { pageMetadata } from '@/lib/constants/site'

export const metadata: Metadata = pageMetadata({
  title: 'How the free assessment works — on site, by photos or video',
  description: 'REDUX assesses every fitting for free — on site in Delhi NCR, or by a photo self-assessment anywhere in India — and returns a report with three prices per fitting.',
  path: '/assessment',
})

// CR-001 phase 8 (D31) — the assessment by mode (BR-S9, BR-S10, BR-S11). Numbers from settings.
export default async function AssessmentPage() {
  const { slaHours, nearKm } = await getProgrammes()
  return (
    <>
      <PageHero image="/site/hero/hero-assessment.jpg" breadcrumbs={[{ name: 'How the assessment works', href: '/assessment' }]} eyebrow="Always free"
        title="An assessment of every fitting — the way that suits your property."
        intro="The assessment never costs anything. How we do it depends on where you are and how many rooms you have; the report you get is the same." />
      <Section labelledBy="modes">
        <SectionHeading id="modes" eyebrow="Three ways" title="On site, by photos, or both with a video call." />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <NumberedCard n="01" icon={MapPin} title="On-site survey" body={`Within about ${nearKm} km of Delhi. A REDUX surveyor visits, photographs every fitting from four angles and records its condition.`} />
          <NumberedCard n="02" icon={Camera} title="Self-assessment" body={`Anywhere. From your phone you add each tap, mixer or shower with four photos — front, side, top and a close-up. Our team prices it within ${slaHours} hours.`} />
          <NumberedCard n="03" icon={Video} title="Self-assessment + video call" body="For larger properties outside the survey area: your photos, then a short video call with our team to walk the rooms." />
        </div>
      </Section>
      <Section tone="surface" labelledBy="report">
        <SectionHeading id="report" eyebrow="What you get" title="One report, three prices per fitting." />
        <div className="mt-12">
          <Steps steps={[
            { title: 'Every fitting, photographed', body: 'Four angles each, with the condition we found: leaks, stiff controls, scaling, worn finish.' },
            { title: 'Three prices side by side', body: 'Restore with REDUX, replace with Eurobrass, or replace at market price — so the saving is plain.' },
            { title: 'A proposal you approve online', body: 'Approve on your phone with a one-time code. Nothing is charged for the assessment, ever.' },
          ]} />
        </div>
        <p className="mt-10 text-[15px] text-muted-ink">High-value projects may also be offered a <Link className="font-medium text-redux-blue hover:underline" href="/demo-programme">free demo</Link> before you decide.</p>
      </Section>
      <CtaBand image="/site/hero/hero-home.jpg" title="Start with the assessment." body="Create a business account to do a self-assessment today, or ask us to visit." />
    </>
  )
}
