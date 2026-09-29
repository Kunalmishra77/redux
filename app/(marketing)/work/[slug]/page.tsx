import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Building2, CalendarRange, CheckCircle2, MapPin, Wrench } from 'lucide-react'
import { BeforeAfter, IconCircle } from '@/components/patterns'
import { CtaBand, Container, JsonLd, PageHero, Section } from '@/components/marketing/sections'
import { CASE_STUDIES, caseStudyBySlug } from '@/lib/content/case-studies'
import { SITE, pageMetadata } from '@/lib/constants/site'

// A10 — Case study. Structure (screen spec A9/A10): property type and scale → the problem → what
// was restored → downtime → before/after → an outcome line. No client quote without permission.
export const dynamicParams = false

export function generateStaticParams() {
  return CASE_STUDIES.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: PageProps<'/work/[slug]'>): Promise<Metadata> {
  const c = caseStudyBySlug((await params).slug)
  if (!c) return {}
  return pageMetadata({ title: c.title, description: c.summary, path: `/work/${c.slug}` })
}

function Block({ icon, title, items }: { icon: typeof Wrench; title: string; items: string[] }) {
  return (
    <section className="rounded-xl border border-line bg-white p-6 shadow-card">
      <div className="flex items-center gap-3">
        <IconCircle icon={icon} />
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
      </div>
      <ul className="mt-5 space-y-3">
        {items.map((i) => (
          <li key={i} className="flex items-start gap-3 text-[15px] leading-relaxed text-ink">
            <CheckCircle2 className="mt-1 size-4 shrink-0 text-redux-blue" aria-hidden />
            {i}
          </li>
        ))}
      </ul>
    </section>
  )
}

export default async function CaseStudyPage({ params }: PageProps<'/work/[slug]'>) {
  const c = caseStudyBySlug((await params).slug)
  if (!c) notFound()

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': c.pairs.flatMap((p) => [
            { '@type': 'ImageObject', contentUrl: `${SITE.url}${p.before}`, caption: `Before — ${p.caption}` },
            { '@type': 'ImageObject', contentUrl: `${SITE.url}${p.after}`, caption: `After — ${p.caption}` },
          ]),
        }}
      />
      <PageHero
        breadcrumbs={[
          { name: 'Our work', href: '/work' },
          { name: c.propertyType, href: `/work/${c.slug}` },
        ]}
        eyebrow="Restoration engagement"
        title={c.title}
        intro={c.summary}
        actions={
          <ul className="mt-8 flex flex-wrap gap-2 text-sm">
            {[
              { icon: Building2, t: c.propertyType },
              { icon: CalendarRange, t: c.scale },
              { icon: MapPin, t: c.city },
            ].map(({ icon: Icon, t }) => (
              <li key={t} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 ring-1 ring-white/20">
                <Icon className="size-4 text-redux-lime" aria-hidden /> {t}
              </li>
            ))}
          </ul>
        }
      />

      <Section>
        <div className="grid gap-6 lg:grid-cols-3">
          <Block icon={Building2} title="The problem" items={c.problem} />
          <Block icon={Wrench} title="What was restored" items={c.restored} />
          <Block icon={CalendarRange} title="Downtime" items={c.downtime} />
        </div>
      </Section>

      <Section tone="surface" labelledBy="ba">
        <h2 id="ba" className="text-[28px] font-semibold tracking-tight text-ink sm:text-4xl">
          Before and after
        </h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {c.pairs.map((p) => (
            <div key={p.after} className="rounded-xl border border-line bg-white p-3 shadow-card">
              <BeforeAfter before={p.before} after={p.after} caption={p.caption} />
            </div>
          ))}
        </div>
      </Section>

      <section className="bg-white py-14 sm:py-16">
        <Container>
          <p className="eyebrow text-redux-blue">Outcome</p>
          <p className="mt-3 max-w-3xl text-2xl leading-snug font-semibold text-ink sm:text-3xl">{c.outcome}</p>
          <p className="mt-6 text-sm text-muted-ink">
            Illustrative engagement. Property names are published only with the client&apos;s permission.
          </p>
          <Link
            href="/work"
            className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-redux-blue hover:underline hover:underline-offset-4"
          >
            <ArrowLeft className="size-4" aria-hidden /> All work
          </Link>
        </Container>
      </section>

      <CtaBand />
    </>
  )
}
