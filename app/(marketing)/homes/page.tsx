import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Brush, Droplet, Droplets, Grid3x3, PackageSearch, Paintbrush, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BeforeAfterGallery } from '@/components/marketing/before-after-gallery'
import { EnquiryForm } from '@/components/marketing/enquiry-form'
import { NumberedCard, PageHero, Section, SectionHeading, Steps } from '@/components/marketing/sections'
import { GALLERY } from '@/lib/content/gallery'
import { getEnquiryContext } from '@/lib/data/website'
import { pageMetadata } from '@/lib/constants/site'

// A6 — For Homes. Copy written in the voice of 01-website-copy.md (the doc has no A6 section yet);
// awaiting REDUX's review.

export const metadata: Metadata = pageMetadata({
  title: 'Bathroom fitting repair and restoration for homes',
  description:
    'Leaking taps, stiff mixers, peeling chrome? REDUX restores the bathroom fittings you already have — function and finish — without retiling. Free home assessment in Delhi NCR.',
  path: '/homes',
})

const HOME_GALLERY_IDS = ['health_faucet-pvd_matte_black', 'basin_mixer-pvd_brushed_gold', 'spout-chrome']

export default async function HomesPage() {
  const { cities, notice } = await getEnquiryContext()
  const gallery = HOME_GALLERY_IDS.map((id) => GALLERY.find((g) => g.id === id)!)

  return (
    <>
      <PageHero
        breadcrumbs={[{ name: 'For homes', href: '/homes' }]}
        eyebrow="For homes"
        title="Keep the fittings you chose. Restore how they work and how they look."
        intro="Good bathroom fittings are built to last longer than their seals and their finish. REDUX restores suitable fittings — so a leaking mixer or a peeling finish does not have to mean new fittings and broken tiles."
      />

      <Section labelledBy="home-problems">
        <SectionHeading id="home-problems" eyebrow="Sound familiar?" title="Small faults that never quite go away." />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <NumberedCard n="01" icon={Droplet} title="A tap that keeps dripping" body="Fixed once, back again. Worn internal parts are usually the cause." />
          <NumberedCard n="02" icon={Brush} title="Peeling or scaled chrome" body="A sound fitting that no longer looks the part." />
          <NumberedCard n="03" icon={PackageSearch} title="A part nobody stocks" body="The model is discontinued and the plumber cannot find the spare." />
          <NumberedCard n="04" icon={Grid3x3} title="No appetite for retiling" body="New fittings of a different size can mean disturbing walls and tiles." />
        </div>
      </Section>

      <Section tone="surface" labelledBy="home-services">
        <SectionHeading id="home-services" eyebrow="What we do" title="Your existing bath fittings. Restored." />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <NumberedCard n="01" icon={Wrench} title="Restore function" body="Address leaks, worn internal parts and problems with how the fitting operates." href="/services/restore-function" />
          <NumberedCard n="02" icon={Paintbrush} title="Restore the finish" body="Recoat suitable fittings in chrome or coloured PVD finishes to renew their appearance." href="/services/restore-finish" />
          <NumberedCard n="03" icon={Droplets} title="Improve efficiency" body="Add compatible water-saving components to taps and showers." href="/services/water-efficiency" />
        </div>
        <p className="mt-8 text-sm text-muted-ink italic">Available repairs and finishes depend on the condition of each fitting.</p>
      </Section>

      <Section labelledBy="home-steps">
        <SectionHeading id="home-steps" eyebrow="How it works" title="Three steps, and nothing is decided until you have seen the prices." />
        <div className="mt-12">
          <Steps
            steps={[
              { title: 'Free assessment at home', body: 'We look at each fitting, photograph it from four angles and note what can be restored.' },
              { title: 'A written scope', body: 'Three prices per fitting — restore, replace with Eurobrass, or replace at market. You choose, fitting by fitting.' },
              { title: 'Restored and refitted', body: 'Fittings are removed and refitted on dates you agree, then tested for leaks and operation at handover.' },
            ]}
          />
        </div>
      </Section>

      <Section tone="surface" labelledBy="home-work">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading id="home-work" eyebrow="See the difference" title="Before and after." />
          <Button asChild variant="outline" className="self-start lg:self-auto">
            <Link href="/work">
              See all work <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
        <BeforeAfterGallery items={gallery} className="mt-10" />
      </Section>

      <Section id="enquiry" labelledBy="home-enquiry">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
          <SectionHeading
            id="home-enquiry"
            eyebrow="Book free assessment"
            title="Tell us about the fittings."
            intro="One of our team will call you within 2 working hours to understand the fittings and arrange a free assessment at your home. The assessment is free and carries no obligation."
          />
          <div className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-8">
            <EnquiryForm cities={cities} noticeVersion={notice?.version ?? null} defaultKind="home" />
          </div>
        </div>
      </Section>
    </>
  )
}
