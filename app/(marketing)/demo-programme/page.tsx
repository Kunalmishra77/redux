import type { Metadata } from 'next'
import { BadgeCheck, Gift, ShieldCheck } from 'lucide-react'
import { CtaBand, NumberedCard, PageHero, Section, SectionHeading } from '@/components/marketing/sections'
import { getProgrammes } from '@/lib/data/catalog'
import { pageMetadata } from '@/lib/constants/site'

export const metadata: Metadata = pageMetadata({
  title: 'Free demo programme — see a restored room before you decide',
  description: 'For qualifying hotels and businesses, REDUX restores one room or one fitting free, with the same warranty as paid work, so you can see the result in your own property.',
  path: '/demo-programme',
})

// CR-001 phase 8 (D31) — the free demo, separate from the paid pilot (BR-D1…D3). Types from demo_types.
export default async function DemoProgrammePage() {
  const { demoTypes } = await getProgrammes()
  return (
    <>
      <PageHero image="/site/hero/hero-demo.jpg" breadcrumbs={[{ name: 'Free demo programme', href: '/demo-programme' }]} eyebrow="Free demo"
        title="See it on your own wall before you commit."
        intro="For qualifying properties, after the assessment, REDUX restores one room or one fitting free — so your team judges the result in your own bathrooms." />
      <Section labelledBy="types">
        <SectionHeading id="types" eyebrow="Two kinds of demo" title="A room, or a single fitting." />
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {demoTypes.length ? demoTypes.map((d, i) => (
            <NumberedCard key={d.code} n={String(i + 1).padStart(2, '0')} icon={Gift} title={d.name}
              body={`${d.description ?? ''}${d.description ? ' · ' : ''}Up to ${d.max_fittings} fitting${d.max_fittings > 1 ? 's' : ''} in ${d.max_units} room${d.max_units > 1 ? 's' : ''}.`} />
          )) : <p className="text-muted-ink">Ask us about a demo for your property.</p>}
        </div>
      </Section>
      <Section tone="surface" labelledBy="terms">
        <SectionHeading id="terms" eyebrow="How it works" title="Free, approved, and guaranteed." />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <NumberedCard n="01" icon={BadgeCheck} title="Offered after the assessment" body="Demos are for properties where a wider restoration is likely. Larger properties are offered a room; others a single fitting." />
          <NumberedCard n="02" icon={Gift} title="Never charged" body="A demo is our investment, not a sale. It is separate from a paid pilot, and you are under no obligation afterwards." />
          <NumberedCard n="03" icon={ShieldCheck} title="Same warranty as paid work" body="The fittings we restore in a demo carry the same REDUX warranty cards as any order." />
        </div>
      </Section>
      <CtaBand title="Start with a free assessment." body="The demo is offered once we have assessed your fittings." />
    </>
  )
}
