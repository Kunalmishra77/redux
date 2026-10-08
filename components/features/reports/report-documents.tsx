import { Check } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { formatInr } from '@/lib/services/money'
import type { ReportFitting } from '@/lib/data/reports'

// CR-001 phase 2 (D25) — customer reports as A4 documents, the same way quotations and invoices are
// (ADR-010: this markup is what Gotenberg renders to PDF in production; print/save in the demo).

const money = (v: number) => formatInr(String(v), 'never')
const date = (d: string | null) => (d ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(d)) : '—')
const byUnit = (fs: ReportFitting[]) => [...new Set(fs.map((f) => f.unit))].map((u) => ({ unit: u, fittings: fs.filter((f) => f.unit === u) }))

function Sheet({ kind, reference, meta, children }: { kind: string; reference: string; meta: React.ReactNode; children: React.ReactNode }) {
  return (
    <article className="mx-auto w-full max-w-[210mm] min-w-[40rem] bg-white p-[14mm] text-[12.5px] leading-snug text-ink shadow-card print:min-w-0 print:shadow-none">
      <header className="flex items-start justify-between border-b-2 border-redux-blue pb-5">
        <Logo withTagline />
        <div className="text-right"><p className="eyebrow text-redux-blue">{kind}</p><p className="num mt-1 text-lg font-semibold">{reference}</p><div className="mt-1 text-[11px] text-muted-ink">{meta}</div></div>
      </header>
      {children}
      <footer className="mt-8 border-t border-line pt-3 text-[10px] text-faint">REDUX — Bath Restorations by Eurobrass · {kind} {reference}</footer>
    </article>
  )
}

function Photo({ src, label, alt }: { src: string | null; label: string; alt: string }) {
  return (
    <figure className="relative overflow-hidden rounded-sm border border-line bg-surface">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt={alt} className="aspect-[4/3] w-full object-cover" /> : <div className="flex aspect-[4/3] items-center justify-center text-[10px] text-faint">No photo</div>}
      <figcaption className={`absolute top-1.5 left-1.5 rounded-sm px-1.5 py-0.5 text-[9px] font-bold tracking-wider ${label === 'AFTER' ? 'bg-redux-lime text-redux-blue' : 'bg-ink text-white'}`}>{label}</figcaption>
    </figure>
  )
}

export function AssessmentReport({ r, noun }: { r: NonNullable<Awaited<ReturnType<typeof import('@/lib/data/reports').loadAssessmentReport>>>; noun: string }) {
  const { survey, quote, fittings } = r
  return (
    <Sheet kind="Assessment report" reference={quote.quote_no} meta={<>Assessed {date(survey.submitted_at ?? survey.scheduled_at)}{survey.surveyor ? <><br />by {survey.surveyor.full_name}</> : null}</>}>
      <section className="grid grid-cols-2 gap-6 py-5">
        <div><p className="eyebrow text-faint">Prepared for</p><p className="mt-1 font-semibold">{survey.property?.customer?.name}</p><p className="text-muted-ink">{survey.property?.name} · {survey.property?.address}</p></div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Fittings" value={String(fittings.length)} />
          <Stat label={`${noun}s`} value={String(new Set(fittings.map((f) => f.unit)).size)} />
          <Stat label="You save" value={money(Number(quote.you_save))} accent />
        </div>
      </section>
      <p className="rounded-sm bg-surface p-3 text-[11.5px] text-muted-ink">Every fitting was photographed from four angles and assessed for restoration, repair or Eurobrass replacement. Prices below are from proposal {quote.quote_no} v{quote.version}, excluding GST.</p>
      {byUnit(fittings).map(({ unit, fittings: fs }) => (
        <section key={unit} className="mt-5 break-inside-avoid">
          <h2 className="mb-2 text-[13px] font-semibold">{/^[0-9A-Z-]+$/.test(unit) ? `${noun} ${unit}` : unit}</h2>
          <div className="space-y-3">
            {fs.map((f) => (
              <div key={f.id} className="grid grid-cols-[9rem_1fr] gap-4 border-b border-line pb-3 last:border-0">
                <Photo src={f.before} label="AS FOUND" alt={`${f.type} as found`} />
                <div>
                  <p className="font-semibold">{f.type}{f.brand ? ` · ${f.brand}` : ''}{f.finish ? ` · ${f.finish}` : ''}</p>
                  {f.conditions.length > 0 && <p className="mt-0.5 text-[11px] text-muted-ink">Found: {f.conditions.join(', ')}</p>}
                  {f.line && (
                    <>
                      <p className="mt-1.5 text-[11.5px]"><span className="font-semibold text-redux-blue">Recommended:</span> {f.line.description}</p>
                      <div className="mt-1.5 grid grid-cols-3 gap-2 text-[11px]">
                        <Price label="REDUX" value={f.line.price} strong />
                        <Price label="New Eurobrass" value={f.line.eurobrass} />
                        <Price label="New at market" value={f.line.market} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      <section className="mt-6 flex items-center justify-between rounded-sm bg-redux-lime/60 px-4 py-3 text-[13px] font-semibold text-redux-blue">
        <span>Restoring with REDUX instead of buying new</span><span className="num">saves {money(Number(quote.you_save))}</span>
      </section>
    </Sheet>
  )
}

export function CompletionReport({ r, noun }: { r: NonNullable<Awaited<ReturnType<typeof import('@/lib/data/reports').loadJobReport>>>; noun: string }) {
  const { job, fittings, warranties } = r
  const handover = (u: (typeof job.units)[number]) => (Array.isArray(u.handover) ? u.handover[0] : u.handover) ?? null
  return (
    <Sheet kind="Completion report" reference={job.job_no} meta={<>{job.actual_start ? `${date(job.actual_start)} – ` : ''}{date(job.actual_end)}</>}>
      <section className="grid grid-cols-2 gap-6 py-5">
        <div><p className="eyebrow text-faint">For</p><p className="mt-1 font-semibold">{job.property?.customer?.name}</p><p className="text-muted-ink">{job.property?.name} · {job.property?.address}</p></div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label={`${noun}s`} value={String(job.units.length)} />
          <Stat label="Fittings" value={String(fittings.length)} />
          <Stat label="Warranty cards" value={String(warranties.length)} accent />
        </div>
      </section>
      <h2 className="mb-2 text-[13px] font-semibold">Handover checks</h2>
      <table className="w-full border-collapse text-[11.5px]">
        <thead><tr className="bg-redux-blue text-left text-white">{[noun, 'No leaks', 'Operation', 'Finish', 'Accepted by', 'Back in service'].map((h) => <th key={h} className="px-2.5 py-2 font-semibold">{h}</th>)}</tr></thead>
        <tbody>
          {job.units.map((u) => {
            const h = handover(u)
            return (
              <tr key={u.id} className="border-b border-line">
                <td className="px-2.5 py-2 font-medium">{u.pu?.label}</td>
                {[h?.leak_check, h?.operation_check, h?.finish_check].map((ok, i) => <td key={i} className="px-2.5 py-2">{ok ? <Check className="size-4 text-success" aria-label="Passed" /> : '—'}</td>)}
                <td className="px-2.5 py-2">{h?.customer_name ?? '—'}</td>
                <td className="px-2.5 py-2">{date(u.back_in_service_at)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {byUnit(fittings).map(({ unit, fittings: fs }) => (
        <section key={unit} className="mt-5 break-inside-avoid">
          <h2 className="mb-2 text-[13px] font-semibold">{/^[0-9A-Z-]+$/.test(unit) ? `${noun} ${unit}` : unit} — before and after</h2>
          <div className="grid grid-cols-2 gap-4">
            {fs.map((f) => (
              <div key={f.id}>
                <div className="grid grid-cols-2 gap-1.5"><Photo src={f.before} label="BEFORE" alt={`${f.type} before`} /><Photo src={f.after} label="AFTER" alt={`${f.type} after`} /></div>
                <p className="mt-1 text-[11px] text-muted-ink">{f.line?.description ?? f.type}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </Sheet>
  )
}

export function WarrantyCertificate({ r, noun }: { r: NonNullable<Awaited<ReturnType<typeof import('@/lib/data/reports').loadJobReport>>>; noun: string }) {
  const { job, warranties } = r
  return (
    <Sheet kind="Warranty certificate" reference={job.job_no} meta={<>Issued {date(job.actual_end)}</>}>
      <section className="py-5">
        <p className="text-[13px]">This certifies that the fittings below, restored by REDUX for <strong>{job.property?.customer?.name}</strong> at {job.property?.name}, are covered from the date each was returned to service.</p>
      </section>
      <table className="w-full border-collapse text-[11.5px]">
        <thead><tr className="bg-redux-blue text-left text-white">{['Card', noun, 'Fitting', 'Cover', 'Valid from', 'Valid until'].map((h) => <th key={h} className="px-2.5 py-2 font-semibold">{h}</th>)}</tr></thead>
        <tbody>
          {warranties.map((w) => (
            <tr key={w.id} className="border-b border-line">
              <td className="num px-2.5 py-2">{w.card_no}</td>
              <td className="px-2.5 py-2">{w.fitting?.unit_label ?? '—'}</td>
              <td className="px-2.5 py-2">{[w.fitting?.ft?.name, w.fitting?.finish?.name].filter(Boolean).join(' · ')}</td>
              <td className="px-2.5 py-2 capitalize">{w.kind}</td>
              <td className="num px-2.5 py-2">{date(w.valid_from)}</td>
              <td className="num px-2.5 py-2 font-semibold">{date(w.valid_until)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {warranties[0]?.terms_text && <section className="mt-6 rounded-sm bg-surface p-4 text-[11px] whitespace-pre-line text-muted-ink"><p className="eyebrow mb-1 text-ink">Terms</p>{warranties[0].terms_text}</section>}
      <p className="mt-6 text-[11px] text-muted-ink">To claim, raise a service request in your REDUX portal and quote the card number.</p>
    </Sheet>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div className={`rounded-sm p-2 ${accent ? 'bg-redux-lime/60 text-redux-blue' : 'bg-surface'}`}><p className="text-[9px] font-semibold tracking-wider uppercase">{label}</p><p className="num mt-0.5 text-[15px] font-semibold">{value}</p></div>
}
function Price({ label, value, strong }: { label: string; value: number | null; strong?: boolean }) {
  return <div className="rounded-sm bg-surface px-2 py-1"><p className="text-[9px] text-muted-ink uppercase">{label}</p><p className={`num ${strong ? 'font-semibold text-ink' : 'text-muted-ink'}`}>{value === null ? '—' : money(value)}</p></div>
}
