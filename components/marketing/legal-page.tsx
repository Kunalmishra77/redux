import * as React from 'react'
import { PageHero, Prose, Section } from '@/components/marketing/sections'

// A15–A17 — not boilerplate: Razorpay KYC will not approve without these live, and the E-Commerce
// Rules require them. Text is a working draft for REDUX's legal review.
export function LegalPage({
  path,
  crumb,
  title,
  intro,
  updated,
  toc,
  children,
}: {
  path: string
  crumb: string
  title: string
  intro: string
  updated: string
  toc: { id: string; label: string }[]
  children: React.ReactNode
}) {
  return (
    <>
      <PageHero breadcrumbs={[{ name: crumb, href: path }]} eyebrow="Legal" title={title} intro={intro} actions={false} />
      <Section>
        <div className="grid gap-12 lg:grid-cols-[220px_1fr] lg:gap-16">
          <nav aria-label="On this page" className="lg:sticky lg:top-28 lg:self-start">
            <p className="eyebrow text-muted-ink">On this page</p>
            <ol className="mt-3 space-y-2 border-l border-line text-sm">
              {toc.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`} className="-ml-px block border-l border-transparent pl-4 text-muted-ink hover:border-redux-blue hover:text-redux-blue">
                    {t.label}
                  </a>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-xs text-faint">Last updated {updated}</p>
          </nav>
          <Prose>{children}</Prose>
        </div>
      </Section>
    </>
  )
}
