import type { Metadata } from 'next'
import { ClipboardCheck, Cog, Factory, Layers, Ruler, ShieldCheck } from 'lucide-react'
import { CtaBand, NumberedCard, PageHero, Section, SectionHeading } from '@/components/marketing/sections'
import { SITE, pageMetadata } from '@/lib/constants/site'

// A8 — Why REDUX / About Eurobrass. Section 4 copy from 01-website-copy.md, verbatim; the rest is
// written in the same voice and awaits REDUX's review.

export const metadata: Metadata = pageMetadata({
  title: 'Why REDUX — 50 years of Eurobrass manufacturing',
  description:
    'REDUX is backed by 50 years of Eurobrass manufacturing. Eurobrass can re-machine unavailable parts for discontinued bathroom fittings at its own facility in New Delhi.',
  path: '/why-redux',
})

export default function WhyReduxPage() {
  return (
    <>
      <PageHero
        breadcrumbs={[{ name: 'Why REDUX', href: '/why-redux' }]}
        eyebrow="Why REDUX"
        title="Manufacturing behind restoration."
        intro="REDUX — Bath Restorations by Eurobrass — is backed by 50 years of Eurobrass manufacturing. That is what lets us restore fittings other teams can only patch."
        aside={
          <div className="grid grid-cols-2 gap-4">
            {[
              { v: '50', l: 'years of Eurobrass manufacturing' },
              { v: '4', l: 'photo angles for every assessed fitting' },
              { v: '3', l: 'prices per fitting — restore, Eurobrass, market' },
              { v: '0', l: 'charge for the assessment' },
            ].map((s) => (
              <div key={s.l} className="rounded-xl bg-white/[0.07] p-5 ring-1 ring-white/15">
                <p className="num text-4xl font-bold text-redux-lime">{s.v}</p>
                <p className="mt-2 text-sm leading-snug text-pale">{s.l}</p>
              </div>
            ))}
          </div>
        }
      />

      <Section labelledBy="pillars">
        <SectionHeading id="pillars" eyebrow="What that means for your fittings" title="Three things a manufacturer can do." />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <NumberedCard n="01" icon={Cog} title="Parts made to fit" body="Eurobrass can re-machine unavailable parts at its own facility to match the fitting's requirements." />
          <NumberedCard n="02" icon={Layers} title="Function & finish" body="REDUX combines mechanical refurbishment with surface restoration to retain suitable premium fittings." />
          <NumberedCard n="03" icon={ClipboardCheck} title="A planned alternative" body="Your team can assess a defined restoration scope instead of relying on repeated makeshift repairs." />
        </div>
        <p className="mt-8 text-sm text-muted-ink italic">
          Component suitability, dimensions and operation are checked for each assessed fitting.
        </p>
      </Section>

      <Section tone="surface" labelledBy="eurobrass">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <SectionHeading
            id="eurobrass"
            eyebrow="About Eurobrass"
            title="A bath-fittings manufacturer, headquartered in New Delhi."
            intro={`Eurobrass has manufactured bath fittings for five decades and is headquartered at ${SITE.address.line1.replace('Eurobrass Headquarters, ', '')}, ${SITE.address.locality}. REDUX brings that manufacturing capability to the fittings already installed in hotels and homes.`}
          />
          <ul className="grid gap-4">
            {[
              { icon: Factory, t: 'Our own facility', b: 'Finish restoration and part re-machining happen at the Eurobrass facility — not in a van on site.' },
              { icon: Ruler, t: 'Made to the fitting', b: 'Re-machined parts are made to match the dimensions and operation of the fitting they go back into.' },
              { icon: ShieldCheck, t: 'Checked before reopening', b: 'Every restored fitting is checked for leaks, tested for operation and inspected for finish at handover.' },
            ].map(({ icon: Icon, t, b }) => (
              <li key={t} className="flex gap-4 rounded-xl border border-line bg-white p-5 shadow-card">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-select text-redux-blue">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold text-ink">{t}</p>
                  <p className="mt-0.5 text-[15px] text-muted-ink">{b}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section labelledBy="honest">
        <div className="max-w-3xl">
          <SectionHeading id="honest" eyebrow="How we talk about it" title="Suitable fittings, not all fittings." />
          <p className="mt-5 text-lg leading-relaxed text-muted-ink">
            Not every fitting can be restored, and we will not say otherwise. The assessment records the condition of each
            fitting and gives three prices — restore, replace with Eurobrass, or replace at market — so your team can decide
            fitting by fitting. Where a fitting is not suitable for restoration, the assessment says so.
          </p>
        </div>
      </Section>

      <CtaBand />
    </>
  )
}
