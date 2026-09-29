import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarRange,
  Camera,
  ClipboardCheck,
  Cog,
  FileText,
  Receipt,
  ShieldCheck,
  Users,
  Wrench,
} from 'lucide-react'
import { IconCircle } from '@/components/patterns'
import { Button } from '@/components/ui/button'
import { BeforeAfterGallery } from '@/components/marketing/before-after-gallery'
import { EnquiryForm } from '@/components/marketing/enquiry-form'
import { EnquiryLink } from '@/components/marketing/enquiry-dialog'
import { NumberedCard, PageHero, Section, SectionHeading, Steps } from '@/components/marketing/sections'
import { CASE_STUDIES } from '@/lib/content/case-studies'
import { GALLERY } from '@/lib/content/gallery'
import { getEnquiryContext, getWarranty } from '@/lib/data/website'
import { PRIMARY_CTA, pageMetadata } from '@/lib/constants/site'

// A5 — For Hotels, the main B2B page. The reader is a Chief Engineer or Maintenance Head: they care
// about downtime, warranty and whether this is a real process. Copy: 01-website-copy.md § A5.

export const metadata: Metadata = pageMetadata({
  title: 'Hotel bathroom fittings restoration',
  description:
    'Restore hotel bathroom fittings in batches around your approved work dates. Free assessment, a pilot bathroom first, three prices per fitting, and checks before every room reopens.',
  path: '/hotels',
})

const HOTEL_GALLERY_IDS = ['shower_mixer-chrome', 'diverter-chrome', 'basin_mixer-chrome']

export default async function HotelsPage() {
  const [{ cities, notice }, warranty] = await Promise.all([getEnquiryContext(), getWarranty()])
  const gallery = HOTEL_GALLERY_IDS.map((id) => GALLERY.find((g) => g.id === id)!)
  const hotelStories = CASE_STUDIES.filter((c) => c.propertyType.toLowerCase().includes('hotel'))

  return (
    <>
      <PageHero
        breadcrumbs={[{ name: 'For hotels', href: '/hotels' }]}
        eyebrow="For hotels"
        title="Restore your bathroom fittings without taking a floor out of service for a month."
        intro="REDUX audits every fitting, restores what can be restored, and replaces only what cannot — at manufacturer-direct pricing, in batches around your approved work dates."
        actions={
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="text-base">
              <EnquiryLink kind="hotel">{PRIMARY_CTA}</EnquiryLink>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="text-base text-white ring-1 ring-white/40 ring-inset hover:bg-white/10 hover:text-white"
            >
              <Link href="#engagement">How an engagement runs</Link>
            </Button>
          </div>
        }
        aside={
          <div className="rounded-2xl bg-white p-6 text-ink shadow-card sm:p-7">
            <p className="eyebrow text-redux-blue">What your team receives</p>
            <ul className="mt-5 space-y-4">
              {[
                { icon: Camera, t: 'A room-by-room audit', b: 'Every fitting recorded and photographed from four angles.' },
                { icon: Receipt, t: 'Three prices per fitting', b: 'Restore, replace with Eurobrass, or replace at market.' },
                { icon: CalendarRange, t: 'A batch plan', b: 'Rooms scheduled around dates your team approves.' },
                { icon: ShieldCheck, t: 'Warranty cards at handover', b: 'Visible in your REDUX portal at any time.' },
              ].map(({ icon, t, b }) => (
                <li key={t} className="flex gap-3">
                  <IconCircle icon={icon} size="sm" />
                  <div>
                    <p className="text-[15px] font-semibold">{t}</p>
                    <p className="text-sm text-muted-ink">{b}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        }
      />

      {/* The problem, in hotel terms */}
      <Section labelledBy="problem">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div>
            <SectionHeading id="problem" eyebrow="The problem, in hotel terms" title="The same room, back on the list." />
            <div className="mt-6 space-y-4 text-lg leading-relaxed text-muted-ink">
              <p>
                A guest reports a dripping tap. Engineering fixes it. Three weeks later the same room is on the list again.
                The model was discontinued in 2019, so the spare is either expensive or not quite right. Meanwhile the
                finish has scaled, and the brand standard audit is next month.
              </p>
              <p className="font-medium text-ink">
                Replacing every fitting is capex. Repeated makeshift repair is a recurring cost with no end. Restoration is
                the option between them.
              </p>
            </div>
          </div>
          <div className="grid gap-4">
            {[
              { icon: Users, t: 'Guest complaints', b: 'Repeat faults in the same rooms, and the repeat visits that follow them.' },
              { icon: ClipboardCheck, t: 'Brand-standard audits', b: 'Scaled and worn finishes that fall below the appearance standard.' },
              { icon: Building2, t: 'Capex vs. recurring cost', b: 'Full replacement on one side; makeshift repair with no end on the other.' },
            ].map(({ icon, t, b }) => (
              <div key={t} className="flex gap-4 rounded-xl border border-line bg-white p-5 shadow-card">
                <IconCircle icon={icon} />
                <div>
                  <p className="font-semibold text-ink">{t}</p>
                  <p className="mt-0.5 text-[15px] text-muted-ink">{b}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* What a hotel engagement looks like */}
      <Section id="engagement" tone="surface" labelledBy="engagement-title">
        <SectionHeading id="engagement-title" eyebrow="How it runs" title="What a hotel engagement looks like" />
        <div className="mt-12">
          <Steps
            steps={[
              {
                title: 'Free assessment',
                body: 'Our surveyor audits each fitting room by room — type, brand, model, finish and condition — photographed from four angles. You receive a written scope with three prices per fitting: restore, replace with Eurobrass, or replace at market.',
              },
              {
                title: 'A pilot bathroom',
                body: 'Before committing, take one bathroom. Agreed work, agreed cost, agreed timing. Judge the function, the finish and the downtime for yourself.',
              },
              {
                title: 'The wider project',
                body: 'Once the pilot is approved, we plan the rest in batches around dates your team provides.',
              },
            ]}
          />
        </div>
      </Section>

      {/* Downtime */}
      <Section tone="blue" labelledBy="downtime">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <SectionHeading
            id="downtime"
            tone="blue"
            eyebrow="Downtime and work planning"
            title="Agreed before work begins."
            intro="Removal, refitting, access and room availability are agreed before work begins. Your onboarded maintenance panel handles any required civil work — walls or tiles — agreed with REDUX in advance."
          />
          <div className="grid gap-4">
            {[
              { icon: CalendarRange, t: 'Batches around your dates', b: 'Rooms are taken out of service together, around the dates your team approves.' },
              { icon: Wrench, t: 'Removal, factory restoration, refitting', b: 'Scheduled in advance, including transport and testing.' },
              { icon: ShieldCheck, t: 'Checked before reopening', b: 'Every room is checked for leaks, tested for operation and inspected for finish before it returns to service.' },
            ].map(({ icon, t, b }) => (
              <div key={t} className="flex gap-4 rounded-xl bg-white/[0.06] p-5 ring-1 ring-white/15">
                <IconCircle icon={icon} tone="lime" />
                <div>
                  <p className="font-semibold text-white">{t}</p>
                  <p className="mt-0.5 text-[15px] text-pale">{b}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Eurobrass manufacturing */}
      <Section labelledBy="manufacturing">
        <SectionHeading
          id="manufacturing"
          eyebrow="Manufacturing behind restoration"
          title="Discontinued model? Eurobrass can re-machine the part."
          intro="REDUX is backed by 50 years of Eurobrass manufacturing. When the spare for a discontinued model is no longer available, Eurobrass can re-machine the part at its own facility to match the fitting's requirements."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <NumberedCard n="01" icon={Cog} title="Parts made to fit" body="Eurobrass can re-machine unavailable parts at its own facility to match the fitting's requirements." />
          <NumberedCard n="02" icon={FileText} title="Manufacturer-direct pricing" body="Restoration and Eurobrass replacement are priced directly — alongside the market replacement price, so you can compare." />
          <NumberedCard n="03" icon={ClipboardCheck} title="Checked per fitting" body="Component suitability, dimensions and operation are checked for each assessed fitting." />
        </div>
      </Section>

      {/* Engagements + before/after */}
      <Section tone="surface" labelledBy="hotel-work">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            id="hotel-work"
            eyebrow="Hotel engagements"
            title="Before and after, in hotel bathrooms."
            intro="Hotel references are shared on request, for your property type."
          />
          <Button asChild variant="outline" className="self-start lg:self-auto">
            <Link href="/work">
              See all work <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
        <BeforeAfterGallery items={gallery} className="mt-10" />
        <ul className="mt-10 grid gap-4 md:grid-cols-2">
          {hotelStories.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/work/${c.slug}`}
                className="group flex h-full flex-col rounded-xl border border-line bg-white p-6 shadow-card transition-colors hover:border-redux-blue"
              >
                <span className="eyebrow text-redux-blue">
                  {c.propertyType} · {c.scale} · {c.city}
                </span>
                <span className="mt-2 text-lg leading-snug font-semibold text-ink">{c.title}</span>
                <span className="mt-2 text-[15px] text-muted-ink">{c.summary}</span>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-redux-blue">
                  Read the engagement <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* Warranty — periods from settings (A10), never hardcoded */}
      <Section labelledBy="warranty">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <SectionHeading
            id="warranty"
            eyebrow="Warranty"
            title="Mechanical and finish, warranted separately."
            intro="Warranty cards are issued at handover and are visible in your REDUX portal at any time."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: 'Mechanical work', days: warranty.mechanicalDays, icon: Wrench },
              { label: 'Restored finishes', days: warranty.finishDays, icon: BadgeCheck },
            ].map(({ label, days, icon }) => (
              <div key={label} className="rounded-xl border border-line bg-white p-6 shadow-card">
                <IconCircle icon={icon} />
                {days ? (
                  <p className="mt-5">
                    <span className="num text-4xl font-bold text-redux-blue">{days.toLocaleString('en-IN')}</span>
                    <span className="ml-1.5 text-base font-medium text-muted-ink">days</span>
                  </p>
                ) : (
                  <p className="mt-5 text-lg font-semibold text-ink">Stated in your quotation</p>
                )}
                <p className="mt-1 font-semibold text-ink">on {label.toLowerCase()}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Hotel enquiry */}
      <Section id="enquiry" tone="surface" labelledBy="hotel-enquiry">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
          <SectionHeading
            id="hotel-enquiry"
            eyebrow="Hotel enquiry"
            title="A technical walkthrough is the first step."
            intro="Bring your recurring faults and difficult-to-source parts. Together, we'll review representative fittings and maintenance records, then identify whether a selected restoration pilot is suitable."
          />
          <div className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-8">
            <EnquiryForm cities={cities} noticeVersion={notice?.version ?? null} defaultKind="hotel" />
          </div>
        </div>
      </Section>
    </>
  )
}
