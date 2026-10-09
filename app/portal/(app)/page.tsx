import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Camera, CheckCircle2, FileSignature, LifeBuoy, Receipt, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BeforeAfter, formatWhen, JOB_STAGES, Money, StageTracker } from '@/components/patterns'
import { createClient } from '@/lib/supabase/server'
import { quotesAwaitingApproval, requirePortalUser } from '@/lib/data/portal'
import { loadRestoredFittings } from '@/lib/data/portal-fittings'
import { unitNoun } from '@/lib/data/jobs'
import { nowMs } from '@/lib/services/clock'
import { PayButton } from './invoices/pay-button'
import { StartSelfAssessmentButton } from './self-assessment-card'

export const metadata: Metadata = { title: 'My REDUX' }

// D2s — active job, quotes to approve, invoices to pay, warranty, before/after, raise a request.
export default async function PortalHome({ searchParams }: PageProps<'/portal'>) {
  const user = await requirePortalUser()
  const { welcome } = await searchParams
  const supabase = await createClient()
  const [{ data: jobs }, { data: quotes }, { data: invoices }, { data: warranties }, fittings, { data: selfs }, { data: offers }] = await Promise.all([
    supabase.from('jobs').select('id, job_no, status, current_stage, is_pilot, customer:customers(type), property:properties(name), units:job_units(status)').order('created_at', { ascending: false }),
    quotesAwaitingApproval().then((data) => ({ data })),
    supabase.from('invoices').select('id, invoice_no, total, amount_paid, status, payment_route').in('status', ['issued', 'part_paid']),
    supabase.from('warranties').select('id, valid_until'),
    loadRestoredFittings(4),
    supabase.from('surveys').select('id, status, review_status, info_request, property:properties(name), fittings(count)').neq('mode', 'onsite').neq('status', 'cancelled').order('created_at', { ascending: false }),
    supabase.rpc('my_self_assessment_offers'),
  ])
  const openSelf = ((selfs ?? []) as unknown as { id: string; status: string; review_status: string | null; info_request: string | null; property: { name: string } | null; fittings: { count: number }[] }[])
    .filter((s) => s.status !== 'submitted' || s.review_status !== 'priced')
  const active = (jobs ?? []).filter((j) => j.status !== 'completed' && j.status !== 'cancelled')
  const done = (jobs ?? []).filter((j) => j.status === 'completed')
  const today = new Date(nowMs()).toISOString().slice(0, 10)
  const soon = new Date(nowMs() + 30 * 86_400_000).toISOString().slice(0, 10)
  const liveW = (warranties ?? []).filter((w) => w.valid_until >= today)
  const expiring = liveW.filter((w) => w.valid_until <= soon).length
  const first = user.name.split(' ')[0]

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow text-redux-blue">Namaste</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink md:text-[28px]">Hello, {first}</h1>
      </div>

      {(welcome || !user.verified) && (
        <section className="rounded-xl border border-redux-blue/20 bg-select p-5">
          <p className="font-semibold text-ink">{welcome ? 'Your business account is ready.' : 'Your account is being verified.'}</p>
          <p className="mt-1 text-sm text-muted-ink">You can raise an enquiry and approve proposals now. REDUX verifies new accounts within a working day; your full history and reports open then. Add your colleagues from <a href="/portal/team" className="font-medium text-redux-blue hover:underline">Team</a>.</p>
          <a href="/book-assessment" className="mt-3 inline-block text-sm font-semibold text-redux-blue hover:underline">Request an assessment →</a>
        </section>
      )}

      {((offers ?? []) as { lead_id: string; mode: string; customer_name: string }[]).map((o) => (
        <section key={o.lead_id} className="flex flex-wrap items-center gap-4 rounded-xl border-2 border-redux-blue bg-white p-5 shadow-card">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-redux-lime text-redux-blue"><Camera className="size-6" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">Your free self-assessment</p>
            <p className="text-sm text-muted-ink">Photograph each tap and mixer at {o.customer_name} from four angles — about two minutes a fitting. Your assessment report and proposal follow within a day.{o.mode === 'video' ? ' We’ll also set up a short video call.' : ''}</p>
          </div>
          <StartSelfAssessmentButton leadId={o.lead_id} />
        </section>
      ))}

      {openSelf.map((s) => (
        <Link key={s.id} href={`/portal/self-assessment/${s.id}`} className={`flex items-center gap-4 rounded-xl bg-white p-5 shadow-card transition hover:bg-select ${s.status === 'submitted' ? 'border border-line' : 'border-2 border-redux-blue'}`}>
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-pale text-redux-blue"><Camera className="size-6" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">{s.status === 'submitted' ? 'Self-assessment sent — we’re preparing your report' : s.review_status === 'needs_info' ? 'We need a little more for your self-assessment' : 'Continue your self-assessment'}</p>
            <p className="text-sm text-muted-ink">{s.property?.name} · <span className="num">{s.fittings[0]?.count ?? 0}</span> fittings{s.review_status === 'needs_info' && s.info_request ? ` · ${s.info_request}` : ''}</p>
          </div>
          <ArrowRight className="size-5 shrink-0 text-redux-blue" aria-hidden />
        </Link>
      ))}

      {(quotes ?? []).map((q) => (
        <Link key={q.id} href={`/portal/quotes/${q.id}`} className="flex items-center gap-4 rounded-xl border-2 border-redux-blue bg-white p-5 shadow-card transition hover:bg-select">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-redux-lime text-redux-blue"><FileSignature className="size-6" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">Your quotation is ready to approve</p>
            <p className="text-sm text-muted-ink"><span className="num">{q.quote_no}</span> · <Money value={q.total} paise="never" /> · you save <Money value={q.you_save} paise="never" className="font-semibold text-success" /> · valid until {formatWhen(q.valid_until!, false)}</p>
          </div>
          <ArrowRight className="size-5 shrink-0 text-redux-blue" aria-hidden />
        </Link>
      ))}

      {active.map((j) => {
        const units = j.units as { status: string }[]
        const at = JOB_STAGES.findIndex((s) => s.key === j.current_stage)
        const noun = unitNoun((j.customer as unknown as { type: string } | null)?.type)
        return (
          <Link key={j.id} href={`/portal/jobs/${j.id}`} className="block rounded-xl border border-line bg-white p-5 shadow-card transition hover:border-redux-blue/40">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="eyebrow text-muted-ink">Restoration in progress{j.is_pilot ? ' · pilot' : ''}</p>
                <p className="mt-1 text-lg font-semibold text-ink">{(j.property as unknown as { name: string } | null)?.name}</p>
              </div>
              <p className="text-sm text-muted-ink"><span className="num font-semibold text-ink">{units.filter((u) => u.status === 'back_in_service').length}/{units.length}</span> {noun.toLowerCase()}s back in service</p>
            </div>
            <StageTracker current={j.current_stage} compact />
            <p className="mt-3 text-sm font-medium text-ink">Step {at + 1} of 7 · {JOB_STAGES[at]?.label}{units.some((u) => u.status === 'blocked') && <span className="ml-2 text-warning">· waiting on site work</span>}</p>
          </Link>
        )
      })}

      {done.map((j) => (
        <Link key={j.id} href={`/portal/jobs/${j.id}`} className="flex items-center gap-4 rounded-xl border border-success/30 bg-white p-5 shadow-card transition hover:border-success/60">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#EAF7EE] text-success"><CheckCircle2 className="size-6" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow text-success">Restoration complete</p>
            <p className="mt-0.5 font-semibold text-ink">{(j.property as unknown as { name: string } | null)?.name}</p>
            <p className="text-sm text-muted-ink">{(j.units as { status: string }[]).length} {unitNoun((j.customer as unknown as { type: string } | null)?.type).toLowerCase()}{(j.units as unknown[]).length === 1 ? '' : 's'} back in service · job {j.job_no}</p>
          </div>
          <ArrowRight className="size-5 shrink-0 text-muted-ink" aria-hidden />
        </Link>
      ))}

      <div className="grid gap-4 md:grid-cols-3">
        <Tile href="/portal/warranty" icon={ShieldCheck} title={`${liveW.length} warranty card${liveW.length === 1 ? '' : 's'}`} body={expiring ? `${expiring} expiring within 30 days` : liveW.length ? 'All active' : 'Issued at handover'} warn={!!expiring} />
        <Tile href="/portal/invoices" icon={Receipt} title={(invoices ?? []).length ? `${invoices!.length} invoice${invoices!.length === 1 ? '' : 's'} to pay` : 'No payments due'} body={(invoices ?? []).length ? <Money value={invoices!.reduce((s, i) => s + Number(i.total) - Number(i.amount_paid), 0).toFixed(2)} paise="never" /> : 'You’re all settled'} />
        <Tile href="/portal/service-requests/new" icon={LifeBuoy} title="Something not right?" body="Raise a service request — we respond within a day" />
      </div>

      {(invoices ?? []).length > 0 && (
        <section className="rounded-xl border border-line bg-white p-5 shadow-card">
          <h2 className="mb-3 font-semibold text-ink">Payments due</h2>
          <ul className="divide-y divide-line">
            {invoices!.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <Link href={`/portal/invoices/${i.id}`} className="text-sm"><span className="num font-semibold text-ink">{i.invoice_no}</span><span className="block text-muted-ink">Balance <Money value={(Number(i.total) - Number(i.amount_paid)).toFixed(2)} paise="auto" /></span></Link>
                <PayButton invoiceId={i.id} due={Number(i.total) - Number(i.amount_paid)} route={i.payment_route} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {fittings.some((f) => f.after) && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-ink"><Sparkles className="size-4 text-redux-blue" aria-hidden /> Restored for you</h2>
            <Link href="/portal/fittings" className="text-sm font-medium text-redux-blue hover:underline">See all</Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {fittings.filter((f) => f.after).slice(0, 2).map((f) => <div key={f.id} className="rounded-xl border border-line bg-white p-3 shadow-card"><BeforeAfter before={f.before} after={f.after} caption={`${f.unit ? `${f.unit} · ` : ''}${f.name}`} /></div>)}
          </div>
        </section>
      )}

      {!active.length && !done.length && !(quotes ?? []).length && (
        <div className="rounded-xl border border-dashed border-line bg-white p-8 text-center">
          <p className="font-semibold text-ink">Nothing here yet</p>
          <p className="mt-1 text-sm text-muted-ink">Your quotation, job progress and warranty cards will appear here once your free survey is done.</p>
          <Button className="mt-4" variant="whatsapp" asChild><a href="https://wa.me/919810000000">Chat with REDUX</a></Button>
        </div>
      )}
    </div>
  )
}

function Tile({ href, icon: Icon, title, body, warn }: { href: string; icon: typeof ShieldCheck; title: string; body: React.ReactNode; warn?: boolean }) {
  return (
    <Link href={href} className={`flex items-start gap-3 rounded-xl border bg-white p-4 shadow-card transition hover:border-redux-blue/40 ${warn ? 'border-warning/40' : 'border-line'}`}>
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${warn ? 'bg-warning-bg text-warning' : 'bg-pale text-redux-blue'}`}><Icon className="size-5" aria-hidden /></span>
      <span><span className="block font-semibold text-ink">{title}</span><span className="text-sm text-muted-ink">{body}</span></span>
    </Link>
  )
}
