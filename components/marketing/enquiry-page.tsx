import { CalendarCheck, Camera, PhoneCall, Receipt } from 'lucide-react'
import { IconCircle } from '@/components/patterns'
import { Button } from '@/components/ui/button'
import { Breadcrumbs, Container } from '@/components/marketing/sections'
import { EnquiryForm } from '@/components/marketing/enquiry-form'
import { WhatsAppGlyph } from '@/components/marketing/floating-actions'
import { getEnquiryContext } from '@/lib/data/website'
import { SITE, whatsappHref } from '@/lib/constants/site'
import type { EnquirerKind } from '@/lib/validators/enquiry'

// A13 / A14 as full pages — the same form the CTA dialog opens.
export async function EnquiryPage({
  kind,
  path,
  crumb,
  eyebrow,
  title,
  intro,
}: {
  kind: EnquirerKind
  path: string
  crumb: string
  eyebrow: string
  title: string
  intro: string
}) {
  const { cities, notice } = await getEnquiryContext()
  return (
    <div className="bg-surface">
      <Container className="py-10 sm:py-14">
        <Breadcrumbs items={[{ name: crumb, href: path }]} tone="white" />
        <div className="mt-6 grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-14">
          <div className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-8">
            <p className="eyebrow text-redux-blue">{eyebrow}</p>
            <h1 className="mt-2 text-[30px] leading-tight font-semibold tracking-tight text-ink sm:text-4xl">{title}</h1>
            <p className="mt-3 text-base leading-relaxed text-muted-ink">{intro}</p>
            <EnquiryForm
              className="mt-8"
              cities={cities}
              noticeVersion={notice?.version ?? null}
              defaultKind={kind}
              lockKind={kind === 'dealer'}
            />
          </div>
          <aside aria-labelledby="next-steps" className="space-y-6 lg:pt-4">
            <h2 id="next-steps" className="text-lg font-semibold text-ink">
              What happens next
            </h2>
            <ol className="space-y-5">
              {[
                { icon: PhoneCall, t: 'We call within 2 working hours', b: 'To understand the fittings and the faults you are seeing.' },
                { icon: CalendarCheck, t: 'A free assessment is booked', b: 'At a time that suits you or your property team.' },
                { icon: Camera, t: 'Every fitting is recorded', b: 'Type, brand, model, finish and condition — photographed from four angles.' },
                { icon: Receipt, t: 'You receive a written scope', b: 'Three prices per fitting: restore, replace with Eurobrass, or replace at market.' },
              ].map(({ icon, t, b }) => (
                <li key={t} className="flex gap-4">
                  <IconCircle icon={icon} />
                  <div>
                    <p className="font-semibold text-ink">{t}</p>
                    <p className="text-[15px] text-muted-ink">{b}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="rounded-xl border border-line bg-white p-5">
              <p className="font-semibold text-ink">Prefer WhatsApp?</p>
              <p className="mt-1 text-sm text-muted-ink">Send us a photo of the fitting and we&apos;ll take it from there.</p>
              <Button asChild variant="whatsapp" className="mt-4 w-full">
                <a href={whatsappHref(path)} target="_blank" rel="noopener noreferrer">
                  <WhatsAppGlyph className="size-5" /> Message us on WhatsApp
                </a>
              </Button>
              <p className="mt-3 text-center text-sm text-muted-ink">
                or call <a href={`tel:${SITE.phoneE164}`} className="num font-semibold text-redux-blue">{SITE.phoneDisplay}</a>
              </p>
            </div>
          </aside>
        </div>
      </Container>
    </div>
  )
}
