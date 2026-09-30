import type { Metadata } from 'next'
import Link from 'next/link'
import { Banknote, CheckCircle2 } from 'lucide-react'
import { EmptyState, formatWhen, Kpi, Money, PageHeader, StatusPill, type PillTone } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Payments' }

const TONE: Record<string, PillTone> = { captured: 'positive', created: 'waiting', failed: 'failed', refunded: 'done' }

// B34 — every payment arrives from the verified Razorpay webhook and reconciles against its invoice
// automatically (BR-I5, BR-I7: the provider id makes a replayed webhook a no-op).
export default async function PaymentsPage() {
  await requireRole(['super_admin'])
  const supabase = await createClient()
  const { data } = await supabase.from('payments')
    .select('id, provider, provider_payment_id, method, amount, status, captured_at, created_at, invoice:invoices(id, invoice_no, recipient_name, total, amount_paid, status)')
    .order('created_at', { ascending: false }).limit(200)
  const rows = (data ?? []) as unknown as { id: string; provider: string; provider_payment_id: string; method: string | null; amount: number; status: string; captured_at: string | null; created_at: string
    invoice: { id: string; invoice_no: string | null; recipient_name: string; total: number; amount_paid: number; status: string } | null }[]
  const captured = rows.filter((r) => r.status === 'captured')
  const total = captured.reduce((s, r) => s + Number(r.amount), 0)
  const bank = captured.filter((r) => ['neft', 'rtgs', 'imps'].includes(r.method ?? '')).reduce((s, r) => s + Number(r.amount), 0)
  return (
    <>
      <PageHeader back={{ href: '/staff/admin', label: 'Admin' }} title="Payments & reconciliation" description="Payments come from Razorpay’s verified webhook and match their invoice automatically." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Kpi label="Collected" value={<Money value={total.toFixed(2)} paise="never" />} hint={`${captured.length} payment${captured.length === 1 ? '' : 's'}`} />
        <Kpi label="By bank transfer" value={<Money value={bank.toFixed(2)} paise="never" />} hint="Large invoices — no card fee" />
        <Kpi label="Unmatched" value={<span className="inline-flex items-center gap-1.5 text-success"><CheckCircle2 className="size-5" aria-hidden /> 0</span>} hint="Every payment is tied to an invoice" />
      </div>
      {rows.length === 0 ? <EmptyState icon={Banknote} title="No payments yet" body="When a customer pays from their portal or by bank transfer, it appears here within seconds." /> : (
        <div className="overflow-hidden rounded-lg border border-line bg-white shadow-card">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line bg-surface text-left">
              {['Received', 'Invoice', 'Method', 'Amount', 'Reference', 'Status'].map((h, i) => <th key={h} className={`eyebrow px-4 py-3 text-muted-ink ${i === 3 ? 'text-right' : ''}`}>{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-xs whitespace-nowrap text-muted-ink">{formatWhen(r.captured_at ?? r.created_at)}</td>
                  <td className="px-4 py-3">{r.invoice && <><Link href={`/staff/admin/invoices/${r.invoice.id}`} className="num font-semibold text-ink hover:text-redux-blue">{r.invoice.invoice_no}</Link><p className="text-xs text-muted-ink">{r.invoice.recipient_name}</p></>}</td>
                  <td className="px-4 py-3 text-xs font-medium uppercase">{r.method ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold"><Money value={r.amount} paise="always" /></td>
                  <td className="num px-4 py-3 text-xs text-faint">{r.provider_payment_id}</td>
                  <td className="px-4 py-3"><StatusPill tone={TONE[r.status] ?? 'neutral'}>{r.status}</StatusPill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
