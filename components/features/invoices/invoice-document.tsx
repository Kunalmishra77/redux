import { Logo } from '@/components/brand/logo'
import { formatInr } from '@/lib/services/money'

// The tax invoice as a document (GST Rule 46). Every figure is the stored one — never recomputed at
// render (BR-I3). Shared by the admin view (B33), the customer portal (D8s) and the PDF (ADR-010).

type Num = number | string
export type InvoiceDoc = {
  invoice_no: string | null; status: string; issue_date: string | null; due_date: string | null; supply_date: string | null
  supplier_gstin: string | null; supplier_name: string | null; supplier_address: string | null; supplier_state_code: string | null
  recipient_gstin: string | null; recipient_name: string; recipient_address: string; place_of_supply_state_code: string; reverse_charge: boolean
  subtotal: Num; discount_amount: Num; taxable_value: Num; cgst: Num; sgst: Num; igst: Num; total: Num; amount_paid: Num; payment_route: string | null
  lines: { id: string; description: string; hsn_sac: string | null; qty: Num; uom: string; unit_price: Num; taxable_value: Num; gst_rate: Num; line_total: Num }[]
}
export type Supplier = { name: string; gstin: string; address: string }

const money = (v: Num) => formatInr(String(v), 'always')
const date = (d: string | null) => d ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(d)) : '—'

export function InvoiceDocument({ inv, fallbackSupplier }: { inv: InvoiceDoc; fallbackSupplier?: Supplier }) {
  const intra = Number(inv.igst) === 0
  // a draft has no frozen supplier yet; it previews with the current settings
  const s = { name: inv.supplier_name ?? fallbackSupplier?.name ?? '—', gstin: inv.supplier_gstin ?? fallbackSupplier?.gstin ?? '—', address: inv.supplier_address ?? fallbackSupplier?.address ?? '—' }
  const due = Math.max(0, Number(inv.total) - Number(inv.amount_paid))
  return (
    <article className="relative mx-auto w-full max-w-[210mm] overflow-hidden bg-white p-[14mm] text-[12.5px] leading-snug text-ink shadow-card print:shadow-none">
      {(inv.status === 'draft' || inv.status === 'cancelled') && (
        <p className={`pointer-events-none absolute inset-0 flex -rotate-12 items-center justify-center text-[88px] font-bold tracking-widest select-none ${inv.status === 'draft' ? 'text-line/70' : 'text-danger/15'}`} aria-hidden>
          {inv.status === 'draft' ? 'DRAFT' : 'CANCELLED'}
        </p>
      )}
      <header className="flex items-start justify-between border-b-2 border-redux-blue pb-5">
        <div>
          <Logo withTagline />
          <p className="mt-3 text-[11px] text-muted-ink">{s.name}<br />{s.address}<br />GSTIN {s.gstin}</p>
        </div>
        <div className="text-right">
          <p className="eyebrow text-redux-blue">Tax invoice</p>
          <p className="num mt-1 text-lg font-semibold">{inv.invoice_no ?? 'Draft'}</p>
          <p className="mt-1 text-[11px] text-muted-ink">Invoice date {date(inv.issue_date)}<br />Date of supply {date(inv.supply_date)}</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-6 py-5">
        <div>
          <p className="eyebrow text-faint">Bill to</p>
          <p className="mt-1 font-semibold">{inv.recipient_name}</p>
          <p className="text-muted-ink">{inv.recipient_address}</p>
          {inv.recipient_gstin && <p className="num text-muted-ink">GSTIN {inv.recipient_gstin}</p>}
        </div>
        <div className="text-[11px] text-muted-ink">
          <p>Place of supply: state code <span className="num text-ink">{inv.place_of_supply_state_code}</span></p>
          <p>Reverse charge: {inv.reverse_charge ? 'Yes' : 'No'}</p>
          <p>Tax: {intra ? 'CGST + SGST (intra-state)' : 'IGST (inter-state)'}</p>
        </div>
      </section>

      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-redux-blue text-left text-white">
            {['#', 'Description', 'SAC', 'Qty', 'Rate', 'Taxable', 'GST', 'Amount'].map((h, i) => (
              <th key={h} className={`px-2 py-2 font-semibold ${i >= 3 ? 'text-right' : ''}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {inv.lines.map((l, i) => (
            <tr key={l.id} className="border-b border-line">
              <td className="num px-2 py-2 align-top text-faint">{i + 1}</td>
              <td className="px-2 py-2 align-top">{l.description}</td>
              <td className="num px-2 py-2 align-top">{l.hsn_sac ?? '—'}</td>
              <td className="num px-2 py-2 text-right align-top whitespace-nowrap">{Number(l.qty)} {l.uom}</td>
              <td className="num px-2 py-2 text-right align-top">{money(l.unit_price)}</td>
              <td className="num px-2 py-2 text-right align-top">{money(l.taxable_value)}</td>
              <td className="num px-2 py-2 text-right align-top">{Number(l.gst_rate)}%</td>
              <td className="num px-2 py-2 text-right align-top font-semibold">{money(l.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-4 ml-auto w-full max-w-sm text-[12px]">
        <Sum label="Subtotal" value={money(inv.subtotal)} />
        {Number(inv.discount_amount) > 0 && <Sum label="Discount" value={`– ${money(inv.discount_amount)}`} />}
        <Sum label="Taxable value" value={money(inv.taxable_value)} />
        {intra ? <><Sum label="CGST" value={money(inv.cgst)} /><Sum label="SGST" value={money(inv.sgst)} /></> : <Sum label="IGST" value={money(inv.igst)} />}
        <div className="mt-1 flex justify-between border-t-2 border-ink pt-2 text-[14px] font-semibold"><span>Invoice total</span><span className="num">{money(inv.total)}</span></div>
        {Number(inv.amount_paid) > 0 && <Sum label="Paid" value={`– ${money(inv.amount_paid)}`} muted />}
        {inv.status !== 'cancelled' && inv.status !== 'draft' && <div className="mt-1 flex justify-between font-semibold"><span>Balance due</span><span className="num">{money(due.toFixed(2))}</span></div>}
      </section>

      <section className="mt-6 rounded-sm bg-surface p-4 text-[11px] text-muted-ink">
        <p className="eyebrow mb-1 text-ink">Payment</p>
        {inv.payment_route === 'virtual_account'
          ? <p>Please pay by NEFT/RTGS to the dedicated account shown in your portal. Transfers reconcile automatically against this invoice.</p>
          : <p>Pay securely by UPI, card or netbanking from the link in your portal or on WhatsApp.</p>}
        <p className="mt-2">This is a computer-generated invoice. Warranty cards for the restored fittings are in your REDUX portal.</p>
      </section>

      <footer className="mt-6 flex justify-between border-t border-line pt-3 text-[10px] text-faint">
        <span>{s.name} · GSTIN {s.gstin}</span>
        <span>{inv.invoice_no ?? 'Draft'} · {date(inv.issue_date)}</span>
      </footer>
    </article>
  )
}

function Sum({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return <div className={`flex justify-between py-0.5 ${muted ? 'text-muted-ink' : ''}`}><span>{label}</span><span className="num">{value}</span></div>
}
