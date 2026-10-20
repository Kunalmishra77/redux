import type { Metadata } from 'next'
import { CalendarRange, Camera, ClipboardCheck, Receipt, ShieldCheck, Timer, Truck, Wrench } from 'lucide-react'
import { IconCircle } from '@/components/patterns'
import { CtaBand, NumberedCard, PageHero, Section, SectionHeading, Steps } from '@/components/marketing/sections'
import { pageMetadata } from '@/lib/constants/site'

// A11 — The assessment & pilot process, "straight from the deck" (01-website-copy.md A1 §7–§8).

export const metadata: Metadata = pageMetadata({
  title: 'The assessment and pilot process',
  description:
    'How a REDUX restoration runs: a free property assessment, a selected pilot bathroom, then the wider project in batches around your approved work dates.',
  path: '/process',
})

export default function ProcessPage() {
  return (
    <>
      <PageHero image="/site/hero/hero-process.jpg"
        breadcrumbs={[{ name: 'Process', href: '/process' }]}
        eyebrow="How it works"
        title="The assessment and pilot process."
        intro="Nothing is decided on a sales call. REDUX audits the fittings, proves the work on a pilot bathroom, and only then plans the wider project — around your dates."
      />

      <Section labelledBy="three">
        <SectionHeading id="three" eyebrow="Three stages" title="Assessment → pilot → wider project" />
        <div className="mt-12">
          <Steps
            steps={[
              { title: 'Property assessment', body: 'REDUX audits the fittings and identifies a suitable restoration scope.' },
              {
                title: 'Selected pilot',
                body: 'After reviewing suitability, REDUX may propose a trial bathroom with agreed work, cost and timing.',
              },
              {
                title: 'Wider project',
                body: "Your team reviews the pilot's function, finish, downtime and cost before approving more bathrooms.",
              },
            ]}
          />
        </div>
      </Section>

      <Section tone="surface" labelledBy="assessment">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <SectionHeading
            id="assessment"
            eyebrow="1 · The free assessment"
            title="Every fitting, recorded."
            intro="The assessment is free and carries no obligation. Our surveyor works room by room, bathroom by bathroom."
          />
          <ul className="grid gap-4">
            {[
              { icon: ClipboardCheck, t: 'Type, brand, model, finish and condition', b: 'Recorded for each fitting — taps, mixers, showers, diverters and aerators.' },
              { icon: Camera, t: 'Four photographs per fitting', b: 'Front, side, top and close-up — before work begins, and again at handover.' },
              { icon: Receipt, t: 'Three prices per fitting', b: 'Restore, replace with Eurobrass, or replace at market — in a written scope.' },
            ].map(({ icon, t, b }) => (
              <li key={t} className="flex gap-4 rounded-xl border border-line bg-white p-5 shadow-card">
                <IconCircle icon={icon} />
                <div>
                  <p className="font-semibold text-ink">{t}</p>
                  <p className="mt-0.5 text-[15px] text-muted-ink">{b}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section labelledBy="pilot">
        <div className="max-w-3xl">
          <SectionHeading
            id="pilot"
            eyebrow="2 · The pilot"
            title="One bathroom first."
            intro="Before committing, take one bathroom. Agreed work, agreed cost, agreed timing. Judge the function, the finish and the downtime for yourself."
          />
        </div>
      </Section>

      <Section tone="blue" labelledBy="downtime">
        <SectionHeading id="downtime" tone="blue" eyebrow="3 · The wider project" title="Room downtime and work planning" />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <NumberedCard tone="blue" n="01" icon={CalendarRange} title="Schedule around availability" body="Your team provides available work dates, helping us schedule restoration in batches." />
          <NumberedCard tone="blue" n="02" icon={Timer} title="Define the downtime" body="We agree the dates your team dismantles the fittings, then our collection, factory restoration and return — including transport and pressure testing." />
          <NumberedCard tone="blue" n="03" icon={ShieldCheck} title="Tested before it comes back" body="Every fitting is pressure-tested for leaks, operated through its full range and inspected for finish at the workshop before it is returned." />
        </div>
        <p className="mt-8 text-sm text-pale italic">Batch sizes and downtime depend on the scope and property-approved work dates.</p>
      </Section>

      <Section labelledBy="journey">
        <SectionHeading id="journey" eyebrow="A fitting's journey" title="From your bathroom to Eurobrass, and back." />
        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Wrench, t: 'Dismantling', b: 'On the agreed dates, by your own maintenance team or plumber.' },
            { icon: Truck, t: 'To Eurobrass', b: 'We collect the fittings and take them to the Eurobrass workshop.' },
            { icon: ClipboardCheck, t: 'Restoration & quality check', b: 'Function and finish restored, pressure-tested and checked before despatch.' },
            { icon: ShieldCheck, t: 'Return & refit', b: 'Delivered back with warranty cards, ready for your team to refit.' },
          ].map(({ icon, t, b }, i) => (
            <li key={t} className="rounded-xl border border-line bg-white p-5 shadow-card">
              <div className="flex items-center justify-between">
                <IconCircle icon={icon} />
                <span className="num text-sm font-semibold text-faint">0{i + 1}</span>
              </div>
              <p className="mt-4 font-semibold text-ink">{t}</p>
              <p className="mt-1 text-[15px] text-muted-ink">{b}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-[15px] text-muted-ink">Inside the Eurobrass facility, each fitting goes through ten steps — from stripping to nickel and chrome electroplating and pressure testing. <a href="/how-we-restore" className="font-semibold text-redux-blue hover:underline">See the REDUX Way →</a></p>
      </Section>

      <CtaBand />
    </>
  )
}
