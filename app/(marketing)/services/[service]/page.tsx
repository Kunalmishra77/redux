import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, CheckCircle2, Droplets, Info, Paintbrush, Wrench } from 'lucide-react'
import { BeforeAfter } from '@/components/patterns'
import { Button } from '@/components/ui/button'
import { CtaBand, JsonLd, NumberedCard, PageHero, Section, SectionHeading, Steps } from '@/components/marketing/sections'
import { GALLERY } from '@/lib/content/gallery'
import { SERVICES, SERVICE_SLUGS, type ServiceSlug } from '@/lib/content/services'
import { SITE, pageMetadata } from '@/lib/constants/site'

// A2 · A3 · A4 — one template, three pages (SEO plan §2 page targeting)
export const dynamicParams = false

export function generateStaticParams() {
  return SERVICE_SLUGS.map((service) => ({ service }))
}

const ICONS = { 'restore-function': Wrench, 'restore-finish': Paintbrush, 'water-efficiency': Droplets } as const

function serviceFor(slug: string) {
  return SERVICE_SLUGS.includes(slug as ServiceSlug) ? SERVICES[slug as ServiceSlug] : undefined
}

export async function generateMetadata({ params }: PageProps<'/services/[service]'>): Promise<Metadata> {
  const s = serviceFor((await params).service)
  if (!s) return {}
  return pageMetadata({ title: s.metaTitle, description: s.metaDescription, path: `/services/${s.slug}` })
}

export default async function ServicePage({ params }: PageProps<'/services/[service]'>) {
  const s = serviceFor((await params).service)
  if (!s) notFound()
  const others = SERVICE_SLUGS.filter((x) => x !== s.slug).map((x) => SERVICES[x])
  const pairs = s.galleryIds.map((id) => GALLERY.find((g) => g.id === id)!).filter(Boolean)

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: s.name,
          description: s.intro,
          serviceType: 'Bathroom fitting restoration',
          areaServed: 'Delhi NCR',
          provider: { '@type': 'LocalBusiness', name: SITE.name, url: SITE.url },
        }}
      />
      <PageHero
        breadcrumbs={[{ name: s.name, href: `/services/${s.slug}` }]}
        eyebrow={`Service ${s.number} · ${s.name}`}
        title={s.headline}
        intro={s.intro}
      />

      <Section labelledBy="how">
        <SectionHeading id="how" eyebrow="What it covers" title={`${s.name}, fitting by fitting`} />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {s.points.map((p, i) => (
            <NumberedCard key={p.title} n={`0${i + 1}`} icon={ICONS[s.slug]} title={p.title} body={p.body} />
          ))}
        </div>
        <div className="mt-8 flex items-start gap-3 rounded-lg bg-surface p-4 text-sm text-muted-ink">
          <Info className="mt-0.5 size-4 shrink-0 text-redux-blue" aria-hidden />
          <p>{s.note}</p>
        </div>
      </Section>

      <Section tone="surface" labelledBy="checks">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
          <div>
            <SectionHeading
              id="checks"
              eyebrow="Checked, not assumed"
              title="What we check"
              intro="Every restoration follows the same assessment, and every fitting is checked before it goes back into service."
            />
            <ul className="mt-8 space-y-3">
              {s.checks.map((c) => (
                <li key={c} className="flex items-start gap-3 text-[15px] text-ink">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-5">
            {pairs.slice(0, 2).map((p) => (
              <div key={p.id} className="rounded-xl border border-line bg-white p-3 shadow-card">
                <BeforeAfter before={p.before} after={p.after} caption={p.caption} />
              </div>
            ))}
            <Link href="/work" className="inline-flex items-center gap-1 text-sm font-semibold text-redux-blue hover:underline hover:underline-offset-4">
              See more before and after <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </Section>

      <Section labelledBy="steps">
        <SectionHeading id="steps" eyebrow="How it works" title="From assessment to reopening" />
        <div className="mt-12">
          <Steps
            steps={[
              { title: 'Free assessment', body: 'Each fitting is recorded — type, brand, model, finish and condition — and photographed from four angles.' },
              { title: 'Written scope', body: 'Three prices per fitting: restore, replace with Eurobrass, or replace at market. You choose.' },
              { title: 'Restoration', body: 'Fittings are removed on agreed dates, restored at the Eurobrass facility and refitted.' },
              { title: 'Checked at handover', body: 'Leak, operation and finish checks before the bathroom returns to service.' },
            ]}
          />
        </div>
      </Section>

      <Section tone="surface" labelledBy="other-services" className="py-14 sm:py-16">
        <SectionHeading id="other-services" eyebrow="Also from REDUX" title="Other services" />
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {others.map((o) => (
            <NumberedCard key={o.slug} n={o.number} icon={ICONS[o.slug]} title={o.name} body={o.intro} href={`/services/${o.slug}`} />
          ))}
        </div>
        <div className="mt-8">
          <Button asChild variant="outline">
            <Link href="/hotels">
              Restoration for hotels <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </Section>

      <CtaBand />
    </>
  )
}
