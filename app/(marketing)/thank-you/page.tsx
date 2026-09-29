import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CalendarCheck, CheckCircle2, PhoneCall } from 'lucide-react'
import { IconCircle } from '@/components/patterns'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/marketing/sections'
import { WhatsAppGlyph } from '@/components/marketing/floating-actions'
import { whatsappHref } from '@/lib/constants/site'

// A18 — Thank you. Copy: 01-website-copy.md § A18, verbatim. Not indexed: it is a conversion step.
export const metadata: Metadata = {
  title: 'Thank you',
  description: 'We’ve received your enquiry.',
  robots: { index: false, follow: true },
  alternates: { canonical: '/thank-you' },
}

export default function ThankYouPage() {
  return (
    <div className="bg-surface">
      <Container className="flex justify-center py-14 sm:py-24">
        <div className="w-full max-w-2xl rounded-2xl border border-line bg-white p-6 text-center shadow-card sm:p-12">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-redux-lime text-redux-blue">
            <CheckCircle2 className="size-8" aria-hidden />
          </span>
          <h1 className="mt-6 text-[28px] leading-tight font-semibold tracking-tight text-ink sm:text-4xl">
            Thank you. We&apos;ve received your enquiry.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-muted-ink">
            One of our team will call you within <strong className="font-semibold text-ink">2 working hours</strong> to
            understand the fittings and arrange a <strong className="font-semibold text-ink">free assessment</strong> at your
            property. The assessment is free and carries no obligation.
          </p>

          <ol className="mx-auto mt-10 grid max-w-lg gap-4 text-left sm:grid-cols-2">
            <li className="flex gap-3 rounded-xl bg-surface p-4">
              <IconCircle icon={PhoneCall} size="sm" />
              <p className="text-sm text-ink">
                <span className="font-semibold">A call from REDUX</span>
                <br />
                <span className="text-muted-ink">within 2 working hours</span>
              </p>
            </li>
            <li className="flex gap-3 rounded-xl bg-surface p-4">
              <IconCircle icon={CalendarCheck} size="sm" />
              <p className="text-sm text-ink">
                <span className="font-semibold">A free assessment</span>
                <br />
                <span className="text-muted-ink">at a time that suits you</span>
              </p>
            </li>
          </ol>

          <div className="mt-10 border-t border-line pt-8">
            <p className="font-medium text-ink">Prefer WhatsApp?</p>
            <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" variant="whatsapp">
                <a href={whatsappHref('/thank-you')} target="_blank" rel="noopener noreferrer">
                  <WhatsAppGlyph className="size-5" /> Message us
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/work">
                  See before and after <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </div>
  )
}
