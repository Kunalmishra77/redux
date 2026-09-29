import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, BadgeCheck } from 'lucide-react'
import { formatWhen, Money } from '@/components/patterns'
import { QuoteDocument, type QuoteDoc } from '@/components/features/quotes/quote-document'
import { QUOTE_DOC_COLUMNS, loadSupplier } from '@/lib/data/quotes'
import { quoteForPortal, requirePortalUser } from '@/lib/data/portal'
import { ApprovePanel } from './approve-panel'
import { nowMs } from '@/lib/services/clock'

export const metadata: Metadata = { title: 'Your quotation' }

// D5s — the highest-stakes screen: the quote, the three options, You save, validity, the terms in
// full, then Approve by OTP. The sentence above the OTP box is part of the evidence (BR-Q4).
export default async function PortalQuote({ params }: PageProps<'/portal/quotes/[id]'>) {
  const { id } = await params
  const user = await requirePortalUser(`/portal/quotes/${id}`)
  const client = await quoteForPortal(id, user)
  if (!client) notFound()
  const [{ data }, supplier, { data: approval }] = await Promise.all([
    client.from('quotations').select(QUOTE_DOC_COLUMNS).eq('id', id).single(),
    loadSupplier(),
    client.from('quote_approvals').select('approver_name, otp_verified_at, pdf_sha256, id').eq('quotation_id', id).maybeSingle(),
  ])
  if (!data) notFound()
  const q = data as unknown as Omit<QuoteDoc, 'lines'> & { lines: (QuoteDoc['lines'][number] & { sort_order: number })[] }
  q.lines.sort((a, b) => a.sort_order - b.sort_order)
  const { data: job } = approval ? await client.from('jobs').select('id').eq('quotation_id', id).maybeSingle() : { data: null }
  const approvable = q.status === 'sent' && !!q.valid_until && q.valid_until >= new Date(nowMs()).toISOString().slice(0, 10)
  return (
    <div className="space-y-6">
      <Link href="/portal" className="inline-flex items-center gap-1 text-sm font-medium text-redux-blue hover:underline"><ArrowLeft className="size-4" aria-hidden /> Home</Link>

      <section className="rounded-xl border border-line bg-white p-5 shadow-card">
        <p className="eyebrow text-redux-blue">Quotation {q.quote_no} · v{q.version}</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">{q.property?.name}</h1>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Figure label="REDUX restoration" value={<Money value={q.total} paise="never" />} strong />
          <Figure label="Buying the same new" value={<Money value={q.market_total} paise="never" />} />
          <Figure label="You save" value={<Money value={q.you_save} paise="never" />} lime />
        </div>
        <p className="mt-3 text-sm text-muted-ink">{q.lines.length} fittings · incl. GST · {approvable ? <>valid until <strong className="text-ink">{formatWhen(q.valid_until!, false)}</strong></> : q.status === 'approved' ? 'approved' : 'no longer valid — ask REDUX for a fresh quotation'}</p>
      </section>

      {approval ? (
        <section className="rounded-xl border-2 border-success bg-white p-5 shadow-card">
          <p className="flex items-center gap-2 text-lg font-semibold text-success"><BadgeCheck className="size-6" aria-hidden /> Approved</p>
          <p className="mt-1 text-sm text-muted-ink">By {approval.approver_name} on {formatWhen(approval.otp_verified_at)}. Reference <span className="num">{approval.id.slice(0, 8).toUpperCase()}</span> · document fingerprint <span className="num">{approval.pdf_sha256.slice(0, 12)}…</span></p>
          {job && <Link href={`/portal/jobs/${job.id}`} className="mt-3 inline-block text-sm font-semibold text-redux-blue hover:underline">Follow the job →</Link>}
        </section>
      ) : approvable ? (
        <ApprovePanel quoteId={id} defaultName={user.name === 'there' ? '' : user.name} phone={user.phone} />
      ) : null}

      <div className="overflow-x-auto rounded-xl bg-white p-1 shadow-card md:p-2"><QuoteDocument q={q} supplier={supplier} /></div>
    </div>
  )
}

function Figure({ label, value, strong, lime }: { label: string; value: React.ReactNode; strong?: boolean; lime?: boolean }) {
  return (
    <div className={`rounded-lg p-3 ${lime ? 'bg-redux-lime/60 text-redux-blue' : 'bg-surface'}`}>
      <p className={`eyebrow ${lime ? 'text-redux-blue' : 'text-muted-ink'}`}>{label}</p>
      <p className={`mt-1 text-xl ${strong || lime ? 'font-semibold' : 'text-muted-ink line-through decoration-1'}`}>{value}</p>
    </div>
  )
}
