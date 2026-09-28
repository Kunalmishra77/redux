import { Logo } from '@/components/brand/logo'
import { formatInr } from '@/lib/services/money'

// The quotation as a document — design system §8. The on-screen preview (B20), the customer's
// portal view (D5s) and the PDF Gotenberg renders all use THIS markup, so they cannot drift (ADR-010).

export type QuoteDoc = {
  quote_no: string; version: number; status: string; issued_at: string | null; valid_until: string | null
  subtotal: string; discount_pct: string; discount_amount: string; taxable_value: string; cgst: string; sgst: string; igst: string
  total: string; market_total: string; you_save: string; terms_text: string | null; warranty_mechanical_days: number | null; warranty_finish_days: number | null
  place_of_supply_state_code: string | null
  customer: { name: string; gstin: string | null; billing_address: string | null } | null
  property: { name: string; address: string } | null
  lines: { id: string; unit_label: string | null; description: string; qty: string; unit_price: string; line_total: string; price_replace_eurobrass: string | null; market_price: string; gst_rate: string; hsn_sac: string | null }[]
}
export type Supplier = { name: string; gstin: string; address: string }

const money = (v: string | number) => formatInr(String(v), 'always')
const date = (d: string | null) => d ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(d)) : '—'

export function QuoteDocument({ q, supplier }: { q: QuoteDoc; supplier: Supplier }) {
  const intra = Number(q.igst) === 0
  return (
    <article className="mx-auto w-full max-w-[210mm] bg-white p-[14mm] text-[12.5px] leading-snug text-ink shadow-card print:shadow-none">
      <header className="flex items-start justify-between border-b-2 border-redux-blue pb-5">
        <div>
          <Logo withTagline />
          <p className="mt-3 text-[11px] text-muted-ink">{supplier.name}<br />{supplier.address}<br />GSTIN {supplier.gstin}</p>
        </div>
        <div className="text-right">
          <p className="eyebrow text-redux-blue">Quotation</p>
          <p className="num mt-1 text-lg font-semibold">{q.quote_no} · v{q.version}</p>
          <p className="mt-1 text-[11px] text-muted-ink">Issued {date(q.issued_at)}<br />Valid until <strong className="text-ink">{date(q.valid_until)}</strong></p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-6 py-5">
        <div>
          <p className="eyebrow text-faint">Prepared for</p>
          <p className="mt-1 font-semibold">{q.customer?.name}</p>
          {q.customer?.billing_address && <p className="text-muted-ink">{q.customer.billing_address}</p>}
          {q.customer?.gstin && <p className="num text-muted-ink">GSTIN {q.customer.gstin}</p>}
        </div>
        <div>
          <p className="eyebrow text-faint">Site</p>
          <p className="mt-1 font-semibold">{q.property?.name}</p>
          <p className="text-muted-ink">{q.property?.address}</p>
        </div>
      </section>

      <table className="w-full border-collapse text-[11.5px]">
        <thead>
          <tr className="bg-redux-blue text-left text-white">
            {['Room', 'Fitting & work', 'Qty', 'REDUX price', 'Eurobrass new', 'Market new'].map((h, i) => (
              <th key={h} className={`px-2.5 py-2 font-semibold ${i >= 2 ? 'text-right' : ''}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {q.lines.map((l) => (
            <tr key={l.id} className="border-b border-line">
              <td className="px-2.5 py-2 align-top whitespace-nowrap">{l.unit_label}</td>
              <td className="px-2.5 py-2 align-top">{l.description}<span className="block text-[10px] text-faint">SAC {l.hsn_sac ?? '—'} · GST {Number(l.gst_rate)}%</span></td>
              <td className="num px-2.5 py-2 text-right align-top">{Number(l.qty)}</td>
              <td className="num px-2.5 py-2 text-right align-top font-semibold">{money(l.line_total)}</td>
              <td className="num px-2.5 py-2 text-right align-top text-muted-ink">{l.price_replace_eurobrass ? money(l.price_replace_eurobrass) : '—'}</td>
              <td className="num px-2.5 py-2 text-right align-top text-muted-ink">{money(l.market_price)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-4 ml-auto w-full max-w-sm text-[12px]">
        <Sum label="Subtotal" value={money(q.subtotal)} />
        {Number(q.discount_amount) > 0 && <Sum label={`Discount (${Number(q.discount_pct)}%)`} value={`– ${money(q.discount_amount)}`} />}
        <Sum label="Taxable value" value={money(q.taxable_value)} />
        {intra ? <><Sum label="CGST" value={money(q.cgst)} /><Sum label="SGST" value={money(q.sgst)} /></> : <Sum label="IGST" value={money(q.igst)} />}
        <div className="mt-1 flex justify-between border-t-2 border-ink pt-2 text-[14px] font-semibold"><span>Total incl. GST</span><span className="num">{money(q.total)}</span></div>
        <Sum label="Buying the same fittings new at market" value={money(q.market_total)} muted />
        {Number(q.you_save) > 0 && (
          // §8: the one place the accent appears in a document
          <div className="mt-2 flex justify-between rounded-sm bg-redux-lime/60 px-2.5 py-2 text-[14px] font-semibold text-redux-blue"><span>You save</span><span className="num">{money(q.you_save)}</span></div>
        )}
      </section>

      <section className="mt-6 rounded-sm bg-surface p-4 text-[11px] text-muted-ink">
        <p className="eyebrow mb-1 text-ink">Warranty & terms</p>
        {q.terms_text ? <p className="whitespace-pre-line">{q.terms_text}</p> : <p>Terms are fixed when the quotation is issued.</p>}
        <p className="mt-2">Available repairs and finishes depend on the condition of each fitting. Where a part is no longer made, Eurobrass can re-machine it.</p>
        <p className="mt-2">Place of supply: state code {q.place_of_supply_state_code ?? '—'}. Approving this quotation by OTP is acceptance of the quotation and the terms shown.</p>
      </section>

      <footer className="mt-6 flex justify-between border-t border-line pt-3 text-[10px] text-faint">
        <span>{supplier.name} · GSTIN {supplier.gstin}</span>
        <span>{q.quote_no} v{q.version} · valid until {date(q.valid_until)}</span>
      </footer>
    </article>
  )
}

function Sum({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return <div className={`flex justify-between py-0.5 ${muted ? 'text-muted-ink' : ''}`}><span>{label}</span><span className="num">{value}</span></div>
}
