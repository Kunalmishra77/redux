import Link from 'next/link'
import { ArrowRight, SearchX } from 'lucide-react'
import { IconCircle } from '@/components/patterns'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/marketing/sections'
import { SiteFooter } from '@/components/marketing/site-footer'
import { SiteHeader } from '@/components/marketing/site-header'
import { getLegalName } from '@/lib/data/website'
import { SERVICE_NAV } from '@/lib/constants/site'

// SEO plan §3: a custom 404 with links to the services and the enquiry form.
export default async function NotFound() {
  const legalName = await getLegalName()
  return (
    <>
      <SiteHeader />
      <main id="main" className="bg-surface">
        <Container className="py-16 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <IconCircle icon={SearchX} size="lg" className="mx-auto" />
            <p className="eyebrow mt-6 text-redux-blue">404 · Page not found</p>
            <h1 className="mt-3 text-[30px] leading-tight font-semibold tracking-tight text-ink sm:text-4xl">
              We couldn&apos;t find that page.
            </h1>
            <p className="mt-4 text-lg text-muted-ink">
              It may have moved. These will get you back on track — or book a free assessment and we&apos;ll call you.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/book-assessment">Book free assessment</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/">Go to the home page</Link>
              </Button>
            </div>
          </div>
          <ul className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-3">
            {SERVICE_NAV.map((s) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className="group flex h-full flex-col rounded-xl border border-line bg-white p-5 shadow-card transition-colors hover:border-redux-blue"
                >
                  <span className="font-semibold text-ink">{s.label}</span>
                  <span className="mt-1 text-sm text-muted-ink">{s.description}</span>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-redux-blue">
                    View <ArrowRight className="size-4" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </main>
      <SiteFooter legalName={legalName} />
    </>
  )
}
