import { Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WhatsAppGlyph } from '@/components/marketing/floating-actions'
import { Container, HeroBackdrop } from '@/components/marketing/sections'
import { SITE, whatsappHref } from '@/lib/constants/site'

type Step = { title: string; body: string }

const DEFAULT_STEPS: Step[] = [
  { title: 'We call within 2 working hours', body: 'To understand the fittings and arrange the assessment at a time that suits you.' },
  { title: 'A free assessment', body: 'Every fitting photographed and checked — on site, or from your own photos.' },
  { title: 'A written scope', body: 'Restore, replace with Eurobrass, or replace at market — three prices per fitting.' },
]

/**
 * The enquiry block on the home, hotels and homes pages: a photograph panel that says what happens next
 * (and how to reach us without the form) beside the form, both the same height.
 */
export function EnquirySection({
  id = 'enquiry',
  headingId,
  eyebrow,
  title,
  intro,
  image = '/site/hero/hero-assessment.jpg',
  steps = DEFAULT_STEPS,
  whatsappFrom,
  children,
}: {
  id?: string
  headingId: string
  eyebrow: string
  title: string
  intro: string
  image?: string
  steps?: Step[]
  /** The page path the WhatsApp message names (E2-S11) */
  whatsappFrom: string
  /** The form */
  children: React.ReactNode
}) {
  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-20 bg-surface py-16 sm:py-20 lg:py-24">
      <Container>
        <div className="grid overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-line lg:grid-cols-[1fr_1.1fr]">
          <div className="relative flex flex-col overflow-hidden bg-ink p-7 text-white sm:p-10">
            <HeroBackdrop src={image} even priority={false} />
            <div className="relative">
              <p className="eyebrow text-redux-lime">{eyebrow}</p>
              <h2 id={headingId} className="mt-3 text-[28px] leading-tight font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
              <p className="mt-4 text-[16px] leading-relaxed text-pale sm:text-lg">{intro}</p>
            </div>
            <ol className="relative mt-8 space-y-5">
              {steps.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="num flex size-9 shrink-0 items-center justify-center rounded-full bg-redux-lime text-sm font-bold text-redux-blue">{i + 1}</span>
                  <div>
                    <p className="font-semibold">{s.title}</p>
                    <p className="mt-0.5 text-[15px] leading-snug text-pale">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="relative mt-10 border-t border-white/15 pt-6 lg:mt-auto">
              <p className="text-sm text-pale">Prefer to talk?</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <Button asChild variant="outline" className="border-white/40 bg-white/5 text-white hover:bg-white/15 hover:text-white">
                  <a href={`tel:${SITE.phoneE164}`}><Phone aria-hidden /> <span className="num">{SITE.phoneDisplay}</span></a>
                </Button>
                <Button asChild variant="whatsapp">
                  <a href={whatsappHref(whatsappFrom)} target="_blank" rel="noopener noreferrer"><WhatsAppGlyph className="size-4" /> WhatsApp us</a>
                </Button>
              </div>
            </div>
          </div>
          <div className="p-5 sm:p-8 lg:p-10">
            <p className="text-lg font-semibold text-ink">Send an enquiry</p>
            <p className="mt-1 mb-6 text-sm text-muted-ink">Free and without obligation — it takes a minute.</p>
            {children}
          </div>
        </div>
      </Container>
    </section>
  )
}
