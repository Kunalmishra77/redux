import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  Brush,
  CalendarRange,
  Camera,
  ClipboardCheck,
  Cog,
  Droplet,
  Droplets,
  Factory,
  Layers,
  PackageSearch,
  Paintbrush,
  Phone,
  ShieldCheck,
  Timer,
  Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconCircle } from '@/components/patterns'
import { BeforeAfterGallery } from '@/components/marketing/before-after-gallery'
import { EnquiryLink } from '@/components/marketing/enquiry-dialog'
import { EnquiryForm } from '@/components/marketing/enquiry-form'
import { Container, JsonLd, NumberedCard, Section, SectionHeading, Steps, Watermark } from '@/components/marketing/sections'
import { FEATURED_GALLERY } from '@/lib/content/gallery'
import { CASE_STUDIES } from '@/lib/content/case-studies'
import { getEnquiryContext } from '@/lib/data/website'
import { PRIMARY_CTA, SECONDARY_CTA, SITE, pageMetadata } from '@/lib/constants/site'

// A1 — Home. The section order IS REDUX's pitch argument (screen spec A1): problem → proof → ask.
// Do not reorder. Copy: 01-website-copy.md § A1, verbatim.

export const metadata: Metadata = {
  ...pageMetadata({
    title: 'Bath fittings restoration in India — REDUX by Eurobrass',
    description:
      'Your existing fittings may have more service life ahead. REDUX repairs worn bathroom fittings and restores their finish — backed by 50 years of Eurobrass manufacturing. Book a free assessment.',
    path: '/',
  }),
  title: { absolute: 'REDUX — Bath fittings restoration by Eurobrass | Free assessment' },
}

export default async function HomePage() {
  const { cities, notice } = await getEnquiryContext()

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'LocalBusiness',
              '@id': `${SITE.url}/#business`,
              name: SITE.name,
              description: SITE.description,
              address: {
                '@type': 'PostalAddress',
                streetAddress: 'D 8/7, Okhla Phase 1',
                addressLocality: 'New Delhi',
                postalCode: '110020',
                addressCountry: 'IN',
              },
              areaServed: ['Delhi NCR', 'India'],
              url: SITE.url,
              telephone: SITE.phoneE164,
              email: SITE.email,
            },
            ...[
              ['Restore function', 'Address leaks, worn internal parts and problems with how the fitting operates.'],
              ['Restore the finish', 'Recoat suitable fittings in chrome or coloured PVD finishes to renew their appearance.'],
              ['Improve efficiency', 'Add compatible water-saving components to taps and showers.'],
            ].map(([name, description]) => ({
              '@type': 'Service',
              name,
              description,
              serviceType: 'Bathroom fitting restoration',
              provider: { '@id': `${SITE.url}/#business` },
              areaServed: 'Delhi NCR',
            })),
          ],
        }}
      />

      {/* 1 · Hero */}
      <section className="relative overflow-hidden bg-redux-blue text-white">
        <Watermark />
        <Container className="relative grid gap-12 py-14 sm:py-20 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-16 lg:py-24">
          <div>
            <p className="eyebrow text-redux-lime">Bath Restorations by Eurobrass</p>
            <h1 className="mt-4 text-[38px] leading-[1.06] font-semibold tracking-tight text-balance sm:text-5xl lg:text-[56px]">
              Your existing fittings may have more service life ahead.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-pale text-pretty sm:text-xl">
              Assess restoration before specifying replacement. REDUX repairs worn bathroom fittings and restores their
              finish — backed by 50 years of Eurobrass manufacturing.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-13 px-7 text-base">
                <EnquiryLink>
                  {PRIMARY_CTA} <ArrowRight aria-hidden />
                </EnquiryLink>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="h-13 px-7 text-base text-white ring-1 ring-white/40 ring-inset hover:bg-white/10 hover:text-white"
              >
                <EnquiryLink kind="dealer">{SECONDARY_CTA}</EnquiryLink>
              </Button>
            </div>
            <ul className="mt-10 grid max-w-xl grid-cols-1 gap-3 text-sm text-pale sm:grid-cols-3">
              {[
                { icon: BadgeCheck, text: 'Free, no-obligation assessment' },
                { icon: Camera, text: 'Every fitting photographed from four angles' },
                { icon: Factory, text: 'Parts re-machined at Eurobrass' },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-2">
                  <Icon className="mt-0.5 size-4 shrink-0 text-redux-lime" aria-hidden />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <figure className="relative mx-auto w-full max-w-lg">
            <div className="rounded-2xl bg-white p-3 text-ink shadow-card sm:p-4">
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['before', '/demo/fittings/basin_mixer-chrome-before.svg', 'BEFORE'],
                    ['after', '/demo/fittings/basin_mixer-chrome-after.svg', 'AFTER'],
                  ] as const
                ).map(([k, src, label]) => (
                  <div key={k} className="relative overflow-hidden rounded-md border border-line bg-surface">
                    <Image
                      src={src}
                      alt={`Basin mixer ${k} restoration — ${k === 'before' ? 'scaled, worn chrome' : 'finish restored in chrome'}`}
                      width={400}
                      height={300}
                      priority
                      className="aspect-[4/3] w-full object-cover"
                    />
                    <span
                      className={
                        k === 'before'
                          ? 'eyebrow absolute top-2 left-2 rounded-sm bg-ink px-2 py-0.5 text-white'
                          : 'eyebrow absolute top-2 left-2 rounded-sm bg-redux-lime px-2 py-0.5 text-redux-blue'
                      }
                    >
                      {label}
                    </span>
                  </div>
                ))}
              </div>
              <figcaption className="flex items-center justify-between gap-3 px-1 pt-3 pb-1">
                <span className="text-sm">
                  <span className="font-semibold">Basin mixer</span>
                  <span className="text-muted-ink"> — cartridge replaced, chrome restored</span>
                </span>
                <IconCircle icon={Wrench} size="sm" />
              </figcaption>
            </div>
            <div className="absolute -bottom-6 -left-4 hidden rounded-xl bg-white px-4 py-3 text-ink shadow-card sm:block">
              <p className="num text-2xl leading-none font-bold text-redux-blue">50 years</p>
              <p className="mt-1 text-xs text-muted-ink">of Eurobrass manufacturing</p>
            </div>
          </figure>
        </Container>
      </section>

      {/* 2 · Problems */}
      <Section labelledBy="problems">
        <SectionHeading id="problems" eyebrow="The problem" title="Same fittings. Same faults. Every time." />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <NumberedCard
            n="01"
            icon={Droplet}
            title="Recurring faults"
            body="Leaks, stiff controls and inconsistent flow cause repeat visits and warrant a closer assessment."
          />
          <NumberedCard
            n="02"
            icon={PackageSearch}
            title="Unavailable parts"
            body="Discontinued models leave teams choosing between expensive spares and substitutes of uncertain fit or quality."
          />
          <NumberedCard
            n="03"
            icon={Brush}
            title="Worn finishes"
            body="Scaling and worn finishes can leave repaired fittings below the property's appearance standard."
          />
        </div>
      </Section>

      {/* 3 · Services */}
      <Section tone="surface" labelledBy="services">
        <SectionHeading id="services" eyebrow="What we do" title="Your existing bath fittings. Restored." />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <NumberedCard
            n="01"
            icon={Wrench}
            title="Restore function"
            body="Address leaks, worn internal parts and problems with how the fitting operates."
            href="/services/restore-function"
          />
          <NumberedCard
            n="02"
            icon={Paintbrush}
            title="Restore the finish"
            body="Recoat suitable fittings in chrome or coloured PVD finishes to renew their appearance."
            href="/services/restore-finish"
          />
          <NumberedCard
            n="03"
            icon={Droplets}
            title="Improve efficiency"
            body="Add compatible water-saving components to taps and showers."
            href="/services/water-efficiency"
          />
        </div>
        <p className="mt-8 text-sm text-muted-ink italic">Available repairs and finishes depend on the condition of each fitting.</p>
      </Section>

      {/* 4 · Why REDUX — the credibility line lives here */}
      <Section tone="blue" labelledBy="why">
        <Watermark className="-top-40 -right-24 opacity-70 lg:-top-48" />
        <div className="relative grid gap-12 lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <SectionHeading id="why" tone="blue" eyebrow="Why REDUX" title="Manufacturing behind restoration" />
            <div className="mt-8 rounded-xl bg-white/[0.06] p-6 ring-1 ring-white/15">
              <p className="num text-5xl leading-none font-bold text-redux-lime sm:text-6xl">50</p>
              <p className="mt-2 text-lg font-semibold">years of Eurobrass manufacturing</p>
              <p className="mt-2 text-sm leading-relaxed text-pale">
                Unavailable parts can be re-machined at Eurobrass’s own facility — the credibility behind every restoration.
              </p>
              <Link
                href="/why-redux"
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-white underline-offset-4 hover:underline"
              >
                About Eurobrass <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </div>
          <div>
            <div className="grid gap-5 md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <NumberedCard
                tone="blue"
                n="01"
                icon={Cog}
                title="Parts made to fit"
                body="Eurobrass can re-machine unavailable parts at its own facility to match the fitting's requirements."
              />
              <NumberedCard
                tone="blue"
                n="02"
                icon={Layers}
                title="Function & finish"
                body="REDUX combines mechanical refurbishment with surface restoration to retain suitable premium fittings."
              />
              <NumberedCard
                tone="blue"
                n="03"
                icon={ClipboardCheck}
                title="A planned alternative"
                body="Your team can assess a defined restoration scope instead of relying on repeated makeshift repairs."
              />
            </div>
            <p className="mt-6 text-sm text-pale italic">
              Component suitability, dimensions and operation are checked for each assessed fitting.
            </p>
          </div>
        </div>
      </Section>

      {/* 5 · Before / after */}
      <Section labelledBy="gallery">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            id="gallery"
            eyebrow="See the difference"
            title="Before and after."
            intro="Every restoration is photographed from four angles before work begins and again at handover. Here is a selection."
          />
          <Button asChild variant="outline" className="self-start lg:self-auto">
            <Link href="/work">
              See all work <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
        <BeforeAfterGallery items={FEATURED_GALLERY} className="mt-10" />
      </Section>

      {/* 6 · Engagements — only names REDUX has cleared (client input A7) */}
      <Section tone="surface" labelledBy="engagements" className="py-14 sm:py-16 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:items-center">
          <SectionHeading
            id="engagements"
            eyebrow="Selected restoration engagements"
            title="Hotels and homes across NCR and beyond."
            intro="Hotel references are shared on request, for your property type. Read how an engagement runs from assessment to reopening."
          />
          <ul className="grid gap-4 sm:grid-cols-3">
            {CASE_STUDIES.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/work/${c.slug}`}
                  className="group flex h-full flex-col rounded-xl border border-line bg-white p-5 shadow-card transition-colors hover:border-redux-blue"
                >
                  <span className="eyebrow text-redux-blue">{c.propertyType}</span>
                  <span className="mt-2 text-[15px] leading-snug font-semibold text-ink">{c.scale}</span>
                  <span className="mt-1 text-sm text-muted-ink">{c.city}</span>
                  <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-redux-blue">
                    Read <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* 7 · Process */}
      <Section labelledBy="process">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading id="process" eyebrow="How it works" title="The assessment and pilot process" />
          <Button asChild variant="outline" className="self-start lg:self-auto">
            <Link href="/process">
              The full process <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
        <div className="mt-12">
          <Steps
            steps={[
              {
                title: 'Property assessment',
                body: 'REDUX audits the fittings and identifies a suitable restoration scope.',
              },
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

      {/* 8 · Downtime — reassurance, not sales */}
      <Section tone="surface" labelledBy="downtime">
        <SectionHeading id="downtime" eyebrow="Downtime" title="Room downtime and work planning" />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <NumberedCard
            n="01"
            icon={CalendarRange}
            title="Schedule around availability"
            body="Your team provides available work dates, helping us schedule restoration in batches."
          />
          <NumberedCard
            n="02"
            icon={Timer}
            title="Define the downtime"
            body="We confirm the schedule for removal, factory restoration and refitting, including transport and testing."
          />
          <NumberedCard
            n="03"
            icon={ShieldCheck}
            title="Check before reopening"
            body="We check for leaks, test fitting operation and inspect the finish before returning rooms to service."
          />
        </div>
        <p className="mt-8 text-sm text-muted-ink italic">
          Batch sizes and downtime depend on the scope and property-approved work dates.
        </p>
      </Section>

      {/* 9 · Enquiry — the tab sets the lead source */}
      <Section id="enquiry" labelledBy="enquiry-title">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
          <div>
            <SectionHeading
              id="enquiry-title"
              eyebrow="Book free assessment"
              title="A technical walkthrough is the first step."
              intro="Bring your recurring faults and difficult-to-source parts. Together, we'll review representative fittings and maintenance records, then identify whether a selected restoration pilot is suitable."
            />
            <ul className="mt-8 space-y-4">
              {[
                ['We call within 2 working hours', 'To understand the fittings and arrange a visit at a time that suits you.'],
                ['The assessment is free', 'No charge and no obligation — for a single bathroom or a whole property.'],
                ['You receive a written scope', 'Restore, replace with Eurobrass, or replace at market — three prices per fitting.'],
              ].map(([t, b]) => (
                <li key={t} className="flex gap-4">
                  <IconCircle icon={BadgeCheck} size="sm" />
                  <div>
                    <p className="font-semibold text-ink">{t}</p>
                    <p className="text-[15px] text-muted-ink">{b}</p>
                  </div>
                </li>
              ))}
            </ul>
            <a
              href={`tel:${SITE.phoneE164}`}
              className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-redux-blue hover:underline hover:underline-offset-4"
            >
              <Phone className="size-4" aria-hidden /> Prefer to call? <span className="num">{SITE.phoneDisplay}</span>
            </a>
          </div>
          <div className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-8">
            <EnquiryForm cities={cities} noticeVersion={notice?.version ?? null} />
          </div>
        </div>
      </Section>
    </>
  )
}
