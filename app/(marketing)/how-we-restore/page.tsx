import type { Metadata } from 'next'
import { CtaBand, PageHero, Section, SectionHeading } from '@/components/marketing/sections'
import { PROCESS_INTRO, PROCESS_STEPS } from '@/lib/content/process'
import { pageMetadata } from '@/lib/constants/site'

export const metadata: Metadata = pageMetadata({
  title: 'The REDUX Way — how a faucet is rechromed and restored',
  description: 'The ten steps REDUX follows to restore a faucet: assessment, dismantling into child parts, stripping, re-grinding, polishing, nickel and chrome electroplating, re-assembly, pressure testing and protective packing.',
  path: '/how-we-restore',
})

// CR-001 phase 8 (D31) — the rechroming & refinishing story, from REDUX's own SOP (lib/content/process.ts)
export default function HowWeRestorePage() {
  return (
    <>
      <PageHero breadcrumbs={[{ name: 'The REDUX Way', href: '/how-we-restore' }]} eyebrow="The REDUX Way"
        title="Ten steps from tarnished to factory-fresh." intro={PROCESS_INTRO} />
      <Section labelledBy="steps">
        <SectionHeading id="steps" eyebrow="Rechroming, reviving and refinishing" title="What happens to every fitting." />
        <ol className="relative mt-12 space-y-6 before:absolute before:top-2 before:bottom-2 before:left-6 before:w-px before:bg-line sm:before:left-7">
          {PROCESS_STEPS.map((s) => (
            <li key={s.n} className="relative flex gap-5 sm:gap-6">
              <span className="num relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full bg-redux-blue text-base font-semibold text-white ring-4 ring-white sm:size-14">{s.n}</span>
              <div className="flex-1 rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
                <h3 className="text-lg font-semibold text-ink">{s.title}</h3>
                <dl className="mt-3 grid gap-3 text-[15px] leading-relaxed sm:grid-cols-[7rem_1fr]">
                  <dt className="eyebrow pt-1 text-redux-blue">Objective</dt><dd className="text-ink">{s.objective}</dd>
                  <dt className="eyebrow pt-1 text-redux-blue">What we do</dt><dd className="text-muted-ink">{s.actions}</dd>
                </dl>
              </div>
            </li>
          ))}
        </ol>
      </Section>
      <CtaBand title="See it on your own fittings." body="Start with a free assessment — every fitting photographed, assessed and priced before anything is removed." />
    </>
  )
}
