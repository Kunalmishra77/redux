import type { Metadata } from 'next'
import { CtaBand, PageHero, Section, SectionHeading } from '@/components/marketing/sections'
import { FINISH_NOTE, PROCESS_INTRO, PROCESS_STAGES, PROCESS_STEPS } from '@/lib/content/process'
import { mediaUrl } from '@/lib/data/catalog'
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
      <PageHero image="/site/process/process-07-plating.jpg" breadcrumbs={[{ name: 'The REDUX Way', href: '/how-we-restore' }]} eyebrow="The REDUX Way"
        title="Ten steps from tarnished to factory-fresh." intro={PROCESS_INTRO} />
      <Section tone="surface" labelledBy="stages">
        <SectionHeading id="stages" eyebrow="One fitting, five moments" title="From bare brass to mirror chrome." />
        <ol className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {PROCESS_STAGES.map((s, i) => (
            <li key={s.image} className={`overflow-hidden rounded-2xl bg-white shadow-card${i === PROCESS_STAGES.length - 1 ? ' col-span-2 sm:col-span-1' : ''}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(s.image)} alt={s.label} className="aspect-[4/5] w-full object-cover" loading="lazy" />
              <div className="p-4"><p className="num eyebrow text-redux-blue">Step {s.steps}</p><p className="mt-1 text-[15px] font-semibold text-ink">{s.label}</p></div>
            </li>
          ))}
        </ol>
      </Section>
      <Section labelledBy="steps">
        <SectionHeading id="steps" eyebrow="Rechroming, reviving and refinishing" title="What happens to every fitting." />
        <ol className="relative mt-12 space-y-6 before:absolute before:top-2 before:bottom-2 before:left-6 before:w-px before:bg-line sm:before:left-7">
          {PROCESS_STEPS.map((s) => (
            <li key={s.n} className="relative flex gap-5 sm:gap-6">
              <span className="num relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full bg-redux-blue text-base font-semibold text-white ring-4 ring-white sm:size-14">{s.n}</span>
              <div className="flex-1 overflow-hidden rounded-2xl border border-line bg-white shadow-card md:grid md:grid-cols-[1fr_15rem] lg:grid-cols-[1fr_18rem]">
                <div className="p-5 sm:p-6">
                <h3 className="text-lg font-semibold text-ink">{s.title}</h3>
                <dl className="mt-3 grid gap-3 text-[15px] leading-relaxed sm:grid-cols-[7rem_1fr]">
                  <dt className="eyebrow pt-1 text-redux-blue">Objective</dt><dd className="text-ink">{s.objective}</dd>
                  <dt className="eyebrow pt-1 text-redux-blue">What we do</dt><dd className="text-muted-ink">{s.actions}</dd>
                </dl>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element -- static file in public/site */}
                <img src={s.image} alt={s.title} loading="lazy" className="aspect-[4/3] w-full object-cover md:order-last md:h-full" />
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-10 rounded-2xl bg-surface p-5 text-[15px] leading-relaxed text-ink sm:p-6"><strong className="font-semibold">{FINISH_NOTE.included}</strong> {FINISH_NOTE.extra}</p>
      </Section>
      <CtaBand image="/site/process/process-10-packing.jpg" title="See it on your own fittings." body="Start with a free assessment — every fitting photographed, assessed and priced before anything is dismantled." />
    </>
  )
}
