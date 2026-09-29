import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { BeforeAfterGallery } from '@/components/marketing/before-after-gallery'
import { CtaBand, PageHero, Section, SectionHeading } from '@/components/marketing/sections'
import { CASE_STUDIES } from '@/lib/content/case-studies'
import { GALLERY } from '@/lib/content/gallery'
import { pageMetadata } from '@/lib/constants/site'

// A9 — Before & after gallery, filterable by fitting type and finish.
// BR-P3: no customer site photograph appears here (see lib/content/gallery.ts).
export const metadata: Metadata = pageMetadata({
  title: 'Bathroom fitting restoration — before and after',
  description:
    'Before-and-after restorations of basin mixers, shower mixers, diverters and accessories — in chrome and coloured PVD finishes — and how each engagement ran.',
  path: '/work',
})

export default function WorkPage() {
  return (
    <>
      <PageHero
        breadcrumbs={[{ name: 'Our work', href: '/work' }]}
        eyebrow="See the difference"
        title="Before and after."
        intro="Every restoration is photographed from four angles before work begins and again at handover. Here is a selection."
        actions={false}
      />

      <Section labelledBy="gallery-all">
        <h2 id="gallery-all" className="sr-only">
          Before-and-after gallery
        </h2>
        <BeforeAfterGallery items={GALLERY} withFinishFilter />
      </Section>

      <Section tone="surface" labelledBy="engagements">
        <SectionHeading
          id="engagements"
          eyebrow="Restoration engagements"
          title="How the work ran."
          intro="Property type and scale, the problem, what was restored, the downtime — and the outcome."
        />
        <ul className="mt-10 grid gap-6 md:grid-cols-3">
          {CASE_STUDIES.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/work/${c.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-white shadow-card transition-colors hover:border-redux-blue"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local SVG illustration */}
                <img src={c.pairs[0].after} alt="" loading="lazy" className="aspect-[4/3] w-full bg-surface object-cover" />
                <div className="flex flex-1 flex-col p-5">
                  <span className="eyebrow text-redux-blue">
                    {c.propertyType} · {c.city}
                  </span>
                  <span className="mt-2 text-lg leading-snug font-semibold text-ink">{c.title}</span>
                  <span className="mt-2 text-[15px] text-muted-ink">{c.summary}</span>
                  <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-redux-blue">
                    Read <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted-ink">
          Illustrative engagements. Client names are published only with the client&apos;s permission; references are shared
          on request.
        </p>
      </Section>

      <CtaBand />
    </>
  )
}
