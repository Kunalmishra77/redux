import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Eye, Hammer, Hourglass, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatWhen, Money, Panel, StatusPill } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { loadQuote } from '@/lib/data/quotes'
import { QUOTE_STATUS } from '@/lib/constants/statuses'
import { DiscountControl, IssueButton, NewVersionButton } from './quote-actions'

export const metadata: Metadata = { title: 'Quotation' }

// B19 — lines pulled from the assessment, never re-typed; footer with tax split, total, market total
// and You save; Preview (B20) and Issue & send.
export default async function QuotePage({ params }: PageProps<'/staff/quotes/[id]'>) {
  const user = await requireRole(['super_admin', 'surveyor', 'cc_exec'])
  const { id } = await params
  const q = await loadQuote(id)
  if (!q) notFound()
  const supabase = await createClient()
  // BR-R2: a referred business's first quote carries a pre-approved referral discount
  const { data: ref } = await supabase.from('quotations').select('referral_discount_pct, referral:referrals!quotations_referral_id_fkey(referrer:customers!referrals_referrer_customer_id_fkey(name))').eq('id', id).maybeSingle()
  const referral = ref?.referral_discount_pct ? { pct: Number(ref.referral_discount_pct), by: (ref.referral as unknown as { referrer: { name: string } | null } | null)?.referrer?.name ?? null } : null
  const [{ data: threshold }, { data: approval }, { data: job }, { data: discount }, { data: versions }] = await Promise.all([
    supabase.from('settings').select('value').eq('key', 'discount_threshold_pct').maybeSingle(),
    supabase.from('quote_approvals').select('approver_name, approver_phone, otp_verified_at, delivery_channel, gateway_message_id, attempt_count, ip_address, pdf_sha256').eq('quotation_id', id).maybeSingle(),
    supabase.from('jobs').select('id, job_no').eq('quotation_id', id).maybeSingle(),
    supabase.from('discount_approvals').select('requested_pct, reason, decision, decision_note').eq('quotation_id', id).order('requested_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('quotations').select('id, version, status').eq('quote_no', q.quote_no).order('version'),
  ])
  const st = QUOTE_STATUS[q.status]!
  const canEdit = user.role !== 'cc_exec'
  const intra = Number(q.igst) === 0

  return (
    <>
      <Link href="/staff/quotes" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-redux-blue hover:underline"><ArrowLeft className="size-4" aria-hidden /> Quotes</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-redux-blue">Quotation</p>
          <h1 className="num mt-1 text-[28px] leading-tight font-semibold text-ink">{q.quote_no} · v{q.version}</h1>
          <p className="mt-1 text-sm text-muted-ink">{q.customer?.name} · {q.property?.name}</p>
          {(versions?.length ?? 0) > 1 && (
            <p className="mt-2 flex flex-wrap gap-1.5 text-xs">{versions!.map((v) => (
              <Link key={v.id} href={`/staff/quotes/${v.id}`} className={`rounded-sm px-2 py-0.5 ring-1 ${v.id === id ? 'bg-redux-blue text-white ring-redux-blue' : 'text-muted-ink ring-line hover:bg-surface'}`}>v{v.version} · {QUOTE_STATUS[v.status]?.label}</Link>
            ))}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={st.tone}>{st.label}</StatusPill>
          <Button variant="outline" asChild><Link href={`/staff/quotes/${id}/preview`}><Eye aria-hidden /> Preview</Link></Button>
          {canEdit && q.status === 'draft' && <IssueButton quoteId={id} />}
          {canEdit && ['sent', 'expired', 'rejected'].includes(q.status) && <NewVersionButton quoteId={id} />}
          {job && <Button variant="secondary" asChild><Link href={`/staff/jobs/${job.id}`}><Hammer aria-hidden /> Job {job.job_no}</Link></Button>}
        </div>
      </div>

      {q.status === 'pending_approval' && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning">
          <Hourglass className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p><strong>Waiting for the Super Admin.</strong> A {Number(discount?.requested_pct)}% discount is above the {String(threshold?.value ?? 5)}% threshold — the quote can’t be sent until it’s approved. Reason given: “{discount?.reason}”.</p>
        </div>
      )}
      {q.status === 'sent' && (
        <div className="mb-5 rounded-lg border border-line bg-white px-4 py-3 text-sm text-muted-ink">
          Sent to the customer on WhatsApp. They approve it by OTP in their portal — valid until <strong className="text-ink">{formatWhen(q.valid_until!, false)}</strong>. It can no longer be edited; changes become a new version.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="relative overflow-x-auto rounded-lg border border-line bg-white shadow-card">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line bg-surface text-left">
              {['Room', 'Fitting & work', 'REDUX price', 'Eurobrass new', 'Market new'].map((h, i) => <th key={h} className={`eyebrow px-4 py-3 text-muted-ink ${i >= 2 ? 'text-right' : ''}`}>{h}</th>)}
            </tr></thead>
            <tbody>
              {q.lines.map((l) => (
                <tr key={l.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap text-muted-ink">{l.unit_label}</td>
                  <td className="px-4 py-3 text-ink">{l.description}<span className="block text-xs text-faint">SAC {l.hsn_sac ?? '—'} · GST {Number(l.gst_rate)}%</span></td>
                  <td className="px-4 py-3 text-right font-semibold"><Money value={l.line_total} paise="never" /></td>
                  <td className="px-4 py-3 text-right text-muted-ink"><Money value={l.price_replace_eurobrass} paise="never" /></td>
                  <td className="px-4 py-3 text-right text-muted-ink"><Money value={l.market_price} paise="never" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-5">
          <Panel title="Totals">
            <dl className="space-y-1.5 text-sm">
              <Line label="Subtotal" value={q.subtotal} />
              {canEdit && q.status === 'draft'
                ? <DiscountControl quoteId={id} current={Number(q.discount_pct)} threshold={Math.max(Number(threshold?.value ?? 5), referral?.pct ?? 0)} isAdmin={user.role === 'super_admin'} />
                : Number(q.discount_amount) > 0 && <Line label={`Discount (${Number(q.discount_pct)}%)`} value={`-${q.discount_amount}`} />}
              {referral && <p className="rounded-sm bg-pale px-2 py-1 text-xs text-redux-blue">First order of a referred business{referral.by ? ` (by ${referral.by})` : ''}: {referral.pct}% is pre-approved and does not stack with other offers.</p>}
              <Line label="Taxable value" value={q.taxable_value} />
              {intra ? <><Line label="CGST" value={q.cgst} /><Line label="SGST" value={q.sgst} /></> : <Line label="IGST" value={q.igst} />}
              <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Total incl. GST</dt><dd><Money value={q.total} paise="always" /></dd></div>
              <Line label="Market replacement" value={q.market_total} muted />
            </dl>
            {Number(q.you_save) > 0 && <p className="mt-3 flex justify-between rounded-md bg-redux-lime/70 px-3 py-2 font-semibold text-redux-blue"><span>You save</span><Money value={q.you_save} paise="never" /></p>}
            <p className="mt-2 text-xs text-faint">{intra ? 'Intra-state: CGST + SGST' : 'Inter-state: IGST'} · place of supply {q.place_of_supply_state_code ?? '—'}</p>
          </Panel>

          {approval && (
            <Panel title="Approval evidence" action={<ShieldCheck className="size-4 text-success" aria-hidden />}>
              <dl className="space-y-1.5 text-xs">
                <Ev label="Approved by">{approval.approver_name} · {approval.approver_phone}</Ev>
                <Ev label="OTP verified">{formatWhen(approval.otp_verified_at)} (server time)</Ev>
                <Ev label="Delivered via">{approval.delivery_channel} · {approval.gateway_message_id}</Ev>
                <Ev label="Attempts">{approval.attempt_count}</Ev>
                <Ev label="IP address">{String(approval.ip_address ?? '—')}</Ev>
                <Ev label="PDF SHA-256"><span className="font-mono break-all">{approval.pdf_sha256.slice(0, 24)}…</span></Ev>
              </dl>
              <p className="mt-2 text-[11px] text-faint">Append-only record — admissible as electronic evidence (IT Act s.65B / BSA s.63).</p>
            </Panel>
          )}
        </div>
      </div>
    </>
  )
}

function Line({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return <div className={`flex justify-between ${muted ? 'text-muted-ink' : ''}`}><dt>{label}</dt><dd><Money value={value} paise="always" /></dd></div>
}
function Ev({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex justify-between gap-3"><dt className="text-muted-ink">{label}</dt><dd className="text-right text-ink">{children}</dd></div>
}
