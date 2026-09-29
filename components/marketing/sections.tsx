import * as React from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { ChevronRight } from 'lucide-react'
import { cn } from 'cn'
import { IconCircle } from '@/components/patterns'
import { Button } from '@/components/ui/button'
import { EnquiryLink } from '@/components/marketing/enquiry-dialog'
import { PRIMARY_CTA, SECONDARY_CTA, SITE } from '@/lib/constants/site'

// Marketing building blocks. Design system §4: icon in a filled circle is the motif — lime circle
// on blue panels, pale circle on white. No accent lines, edge stripes or decorative gradients.

export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8', className)}>{children}</div>
}

type Tone = 'white' | 'surface' | 'blue'

export function Section({
  id,
  tone = 'white',
  className,
  children,
  labelledBy,
}: {
  id?: string
  tone?: Tone
  className?: string
  children: React.ReactNode
  labelledBy?: string
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn(
        'relative scroll-mt-20 py-16 sm:py-20 lg:py-24',
        tone === 'surface' && 'bg-surface',
        tone === 'blue' && 'overflow-hidden bg-redux-blue text-white',
        className,
      )}
    >
      <Container className="relative">{children}</Container>
    </section>
  )
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  intro,
  tone = 'white',
  align = 'left',
  className,
}: {
  id?: string
  eyebrow?: string
  title: React.ReactNode
  intro?: React.ReactNode
  tone?: Tone
  align?: 'left' | 'center'
  className?: string
}) {
  const onBlue = tone === 'blue'
  return (
    <div className={cn('max-w-3xl', align === 'center' && 'mx-auto text-center', className)}>
      {eyebrow && <p className={cn('eyebrow', onBlue ? 'text-redux-lime' : 'text-redux-blue')}>{eyebrow}</p>}
      <h2
        id={id}
        className={cn(
          'mt-3 text-[28px] leading-[1.15] font-semibold tracking-tight text-balance sm:text-4xl',
          onBlue ? 'text-white' : 'text-ink',
        )}
      >
        {title}
      </h2>
      {intro && (
        <p className={cn('mt-4 text-base leading-relaxed text-pretty sm:text-lg', onBlue ? 'text-pale' : 'text-muted-ink')}>
          {intro}
        </p>
      )}
    </div>
  )
}

export function NumberedCard({
  n,
  icon,
  title,
  body,
  tone = 'white',
  href,
  className,
}: {
  n: string
  icon: LucideIcon
  title: string
  body: React.ReactNode
  tone?: Tone
  href?: string
  className?: string
}) {
  const onBlue = tone === 'blue'
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <IconCircle icon={icon} tone={onBlue ? 'lime' : 'pale'} size="lg" />
        <span className={cn('num text-sm font-semibold', onBlue ? 'text-pale' : 'text-faint')}>{n}</span>
      </div>
      <h3 className={cn('mt-6 text-lg font-semibold', onBlue ? 'text-white' : 'text-ink')}>{title}</h3>
      <p className={cn('mt-2 text-[15px] leading-relaxed', onBlue ? 'text-pale' : 'text-muted-ink')}>{body}</p>
      {href && (
        <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-redux-blue">
          Learn more <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      )}
    </>
  )
  const base = cn(
    'group flex h-full flex-col rounded-xl p-6 sm:p-7',
    onBlue ? 'bg-white/[0.06] ring-1 ring-white/15' : 'border border-line bg-white shadow-card',
    href && 'transition-colors hover:border-redux-blue',
    className,
  )
  return href ? (
    <Link href={href} className={base}>
      {inner}
    </Link>
  ) : (
    <div className={base}>{inner}</div>
  )
}

/** Numbered steps: stacked on mobile, horizontal with connectors on desktop (screen spec A1 §7). */
export function Steps({
  steps,
  tone = 'white',
}: {
  steps: { title: string; body: React.ReactNode; icon?: LucideIcon }[]
  tone?: Tone
}) {
  const onBlue = tone === 'blue'
  return (
    <ol className={cn('grid gap-8', steps.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4', 'lg:gap-6')}>
      {steps.map((s, i) => (
        <li key={s.title} className="relative flex gap-4 lg:flex-col">
          <div className="flex items-center lg:w-full">
            <span
              className={cn(
                'num flex size-12 shrink-0 items-center justify-center rounded-full text-base font-semibold',
                onBlue ? 'bg-redux-lime text-redux-blue' : 'bg-redux-blue text-white',
              )}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            {i < steps.length - 1 && (
              <span aria-hidden className={cn('ml-4 hidden h-px flex-1 lg:block', onBlue ? 'bg-white/25' : 'bg-line')} />
            )}
          </div>
          <div className="lg:pr-6">
            <h3 className={cn('text-lg font-semibold', onBlue ? 'text-white' : 'text-ink')}>{s.title}</h3>
            <p className={cn('mt-2 text-[15px] leading-relaxed', onBlue ? 'text-pale' : 'text-muted-ink')}>{s.body}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

/** The "R" watermark from the deck (design system: blue-2 is the watermark tint). */
export function Watermark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute -top-24 -right-16 font-extrabold leading-none text-redux-blue-2 select-none',
        'text-[420px] sm:text-[560px] lg:-top-32 lg:right-[-2rem] lg:text-[720px]',
        className,
      )}
    >
      R
    </span>
  )
}

export function PageHero({
  eyebrow,
  title,
  intro,
  children,
  actions = true,
  aside,
  breadcrumbs,
}: {
  eyebrow?: string
  title: React.ReactNode
  intro?: React.ReactNode
  children?: React.ReactNode
  actions?: boolean | React.ReactNode
  aside?: React.ReactNode
  breadcrumbs?: { name: string; href: string }[]
}) {
  return (
    <section className="relative overflow-hidden bg-redux-blue text-white">
      <Watermark />
      <Container className={cn('relative py-14 sm:py-20', aside && 'lg:grid lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-14')}>
        <div className="max-w-3xl">
          {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
          {eyebrow && <p className="eyebrow mt-6 text-redux-lime">{eyebrow}</p>}
          <h1 className="mt-3 text-[34px] leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">{title}</h1>
          {intro && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-pale text-pretty">{intro}</p>}
          {children}
          {actions === true ? (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="text-base">
                <EnquiryLink>{PRIMARY_CTA}</EnquiryLink>
              </Button>
            </div>
          ) : (
            actions || null
          )}
        </div>
        {aside && <div className="mt-12 lg:mt-0">{aside}</div>}
      </Container>
    </section>
  )
}

export function CtaBand({
  title = 'A technical walkthrough is the first step.',
  body = 'Bring your recurring faults and difficult-to-source parts. Together, we’ll review representative fittings and maintenance records, then identify whether a selected restoration pilot is suitable.',
  dealer = true,
  dealerOnly = false,
}: {
  title?: string
  body?: string
  dealer?: boolean
  /** The dealer page: the one action is the dealer enquiry */
  dealerOnly?: boolean
}) {
  return (
    <section className="relative overflow-hidden bg-redux-blue text-white">
      <Watermark className="-top-40 lg:-top-56" />
      <Container className="relative flex flex-col gap-8 py-16 lg:flex-row lg:items-center lg:justify-between lg:py-20">
        <div className="max-w-2xl">
          <h2 className="text-[28px] leading-tight font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
          <p className="mt-4 text-lg leading-relaxed text-pale">{body}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="text-base">
            {dealerOnly ? <EnquiryLink kind="dealer">{SECONDARY_CTA}</EnquiryLink> : <EnquiryLink>{PRIMARY_CTA}</EnquiryLink>}
          </Button>
          {dealer && !dealerOnly && (
            <Button asChild size="lg" variant="outline" className="border-white/40 bg-transparent text-base text-white hover:bg-white/10">
              <EnquiryLink kind="dealer">{SECONDARY_CTA}</EnquiryLink>
            </Button>
          )}
        </div>
      </Container>
    </section>
  )
}

export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify output with "<" escaped cannot break out of the script element
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}

/** Visible breadcrumb + schema.org BreadcrumbList (SEO plan §3). */
export function Breadcrumbs({ items, tone = 'blue' }: { items: { name: string; href: string }[]; tone?: 'blue' | 'white' }) {
  const all = [{ name: 'Home', href: '/' }, ...items]
  return (
    <>
      <nav aria-label="Breadcrumb">
        <ol className={cn('flex flex-wrap items-center gap-1.5 text-[13px]', tone === 'blue' ? 'text-pale' : 'text-muted-ink')}>
          {all.map((b, i) => (
            <li key={b.href} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="size-3.5 opacity-60" aria-hidden />}
              {i === all.length - 1 ? (
                <span aria-current="page" className={tone === 'blue' ? 'text-white' : 'text-ink'}>
                  {b.name}
                </span>
              ) : (
                <Link href={b.href} className="hover:underline hover:underline-offset-4">
                  {b.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: all.map((b, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: b.name,
            item: `${SITE.url}${b.href === '/' ? '' : b.href}`,
          })),
        }}
      />
    </>
  )
}

/** Long-form text (legal pages, notices). */
export function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'max-w-3xl text-[16px] leading-relaxed text-ink',
        '[&_h2]:mt-12 [&_h2]:scroll-mt-24 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:first:mt-0',
        '[&_h3]:mt-8 [&_h3]:text-lg [&_h3]:font-semibold',
        '[&_p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_li]:marker:text-redux-blue',
        '[&_a]:font-medium [&_a]:text-redux-blue [&_a]:underline [&_a]:underline-offset-2',
        className,
      )}
    >
      {children}
    </div>
  )
}
