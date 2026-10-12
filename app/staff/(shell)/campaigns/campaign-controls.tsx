'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, MessageSquareReply, Plus, Send, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  cancelCampaignAction, createOfferAction, launchCampaignAction, previewAudienceAction, saveCampaignAction, setCadenceActiveAction,
  setOfferActiveAction, simulateReplyAction,
} from '@/lib/actions/outreach'
import type { AudienceInput, AudiencePreview } from '@/lib/validators/outreach'

// CR-001 phase 9 (D32) — campaign builder, offers and cadences. The audience preview and the launch
// call the same database function, so the number you see is the number that goes (BR-C3).

function useRun() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, done: string, after?: () => void) => start(async () => {
    const r = await fn()
    if (r.ok) { toast.success(done); after?.(); router.refresh() } else toast.error(r.message)
  })
  return { pending, run }
}

const sel = 'h-10 w-full rounded-md border border-line bg-white px-2 text-sm'
const chip = (on: boolean) => `rounded-full px-3 py-1 text-sm ring-1 ${on ? 'bg-redux-blue text-white ring-redux-blue' : 'text-ink ring-line hover:bg-surface'}`
const toggle = <T,>(list: T[], v: T) => list.includes(v) ? list.filter((x) => x !== v) : [...list, v]

type Opt = { id: string; name: string }
type Tpl = { code: string; channel: string; body: string; variables: string[] }
type Offer = { id: string; code: string; title: string; discount_pct: number; valid_until: string }

const LEAD_STATUSES = [['lost', 'Lost'], ['contacted', 'Contacted'], ['new', 'New'], ['surveyed', 'Assessed'], ['quoted', 'Quoted'], ['won', 'Won']] as const

export function CampaignBuilder({ templates, offers, lostReasons, segments, cities }: { templates: Tpl[]; offers: Offer[]; lostReasons: Opt[]; segments: { code: string; name: string }[]; cities: Opt[] }) {
  const [name, setName] = useState('')
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp')
  const [template, setTemplate] = useState('')
  const [offerId, setOfferId] = useState('')
  const [a, setA] = useState<Required<Omit<AudienceInput, 'inactive_days'>> & { inactive_days: number | null }>({
    target: 'leads', tiers: [], statuses: ['lost'], lost_reason_ids: [], segments: [], city_ids: [], inactive_days: null, past_customers: false, referrers: false,
  })
  const [preview, setPreview] = useState<AudiencePreview | null>(null)
  const [when, setWhen] = useState('')
  const [pending, start] = useTransition()
  const [previewing, startPreview] = useTransition()
  const tpls = templates.filter((t) => t.channel === channel)
  const tpl = tpls.find((t) => t.code === template)
  const offer = offers.find((o) => o.id === offerId)

  useEffect(() => {
    const t = setTimeout(() => startPreview(async () => {
      const r = await previewAudienceAction(a, channel)
      if (r.ok) setPreview(r.data); else toast.error(r.message)
    }), 350)
    return () => clearTimeout(t)
  }, [a, channel])

  const sample = tpl ? tpl.body.replace(/\{\{(\d+)\}\}/g, (_, n: string) => {
    const k = tpl.variables[Number(n) - 1]
    return ({ name: 'Sanjay', offer: offer?.title, code: offer?.code, discount: offer ? `${Number(offer.discount_pct)}%` : undefined, until: offer?.valid_until } as Record<string, string | undefined>)[k ?? ''] ?? '…'
  }) : ''
  const save = (launch: boolean) => start(async () => {
    const r = await saveCampaignAction({ name, channel, template_code: template, offer_id: offerId || null, audience: a, scheduled_at: when || null, launch })
    if (r && !r.ok) toast.error(r.message)
  })

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="min-w-0 space-y-6">
        <section className="space-y-4 rounded-lg border border-line bg-white p-5 shadow-card">
          <h2 className="font-semibold text-ink">1 · Message</h2>
          <div className="space-y-1.5"><Label htmlFor="c-name">Campaign name</Label><Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lost on price — October" /></div>
          <div className="flex gap-2">{(['whatsapp', 'email'] as const).map((c) => <button key={c} type="button" aria-pressed={channel === c} className={chip(channel === c)} onClick={() => { setChannel(c); setTemplate('') }}>{c === 'whatsapp' ? 'WhatsApp' : 'Email'}</button>)}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="c-tpl">Template <span className="font-normal text-muted-ink">(marketing only)</span></Label>
              <select id="c-tpl" className={sel} value={template} onChange={(e) => setTemplate(e.target.value)}><option value="">Choose…</option>{tpls.map((t) => <option key={t.code} value={t.code}>{t.code.replace(/_/g, ' ')}</option>)}</select></div>
            <div className="space-y-1.5"><Label htmlFor="c-offer">Offer <span className="font-normal text-muted-ink">(optional)</span></Label>
              <select id="c-offer" className={sel} value={offerId} onChange={(e) => setOfferId(e.target.value)}><option value="">No offer</option>{offers.map((o) => <option key={o.id} value={o.id}>{o.code} · {Number(o.discount_pct)}%</option>)}</select></div>
          </div>
          {sample && <pre className="rounded-md bg-surface p-3 font-sans text-sm whitespace-pre-wrap text-ink">{sample}</pre>}
          {channel === 'email' && <p className="text-xs text-warning">Email is queued and shown in the demo outbox; delivery starts once the email provider is connected.</p>}
        </section>

        <section className="space-y-4 rounded-lg border border-line bg-white p-5 shadow-card">
          <h2 className="font-semibold text-ink">2 · Who</h2>
          <div className="flex gap-2">{(['leads', 'accounts'] as const).map((t) => <button key={t} type="button" aria-pressed={a.target === t} className={chip(a.target === t)} onClick={() => setA({ ...a, target: t })}>{t === 'leads' ? 'Enquiries (leads)' : 'Business accounts'}</button>)}</div>
          <Field label="Tier">{(['A', 'B', 'C'] as const).map((t) => <button key={t} type="button" aria-pressed={a.tiers.includes(t)} className={chip(a.tiers.includes(t))} onClick={() => setA({ ...a, tiers: toggle(a.tiers, t) })}>{t}</button>)}</Field>
          {a.target === 'leads' ? (
            <>
              <Field label="Stage">{LEAD_STATUSES.map(([k, l]) => <button key={k} type="button" aria-pressed={a.statuses.includes(k)} className={chip(a.statuses.includes(k))} onClick={() => setA({ ...a, statuses: toggle(a.statuses, k) })}>{l}</button>)}</Field>
              {a.statuses.includes('lost') && <Field label="Lost because">{lostReasons.map((r) => <button key={r.id} type="button" aria-pressed={a.lost_reason_ids.includes(r.id)} className={chip(a.lost_reason_ids.includes(r.id))} onClick={() => setA({ ...a, lost_reason_ids: toggle(a.lost_reason_ids, r.id) })}>{r.name}</button>)}</Field>}
              <Field label="City">{cities.map((c) => <button key={c.id} type="button" aria-pressed={a.city_ids.includes(c.id)} className={chip(a.city_ids.includes(c.id))} onClick={() => setA({ ...a, city_ids: toggle(a.city_ids, c.id) })}>{c.name}</button>)}</Field>
            </>
          ) : (
            <Field label="Only">
              <button type="button" aria-pressed={a.past_customers} className={chip(a.past_customers)} onClick={() => setA({ ...a, past_customers: !a.past_customers })}>Past customers</button>
              <button type="button" aria-pressed={a.referrers} className={chip(a.referrers)} onClick={() => setA({ ...a, referrers: !a.referrers })}>Have referred someone</button>
            </Field>
          )}
          <Field label="Segment">{segments.map((s) => <button key={s.code} type="button" aria-pressed={a.segments.includes(s.code)} className={chip(a.segments.includes(s.code))} onClick={() => setA({ ...a, segments: toggle(a.segments, s.code) })}>{s.name}</button>)}</Field>
          <div className="max-w-xs space-y-1.5"><Label htmlFor="c-quiet">Quiet for at least (days)</Label><Input id="c-quiet" type="number" min={1} className="num" value={a.inactive_days ?? ''} onChange={(e) => setA({ ...a, inactive_days: e.target.value === '' ? null : Number(e.target.value) })} placeholder="any" /></div>
        </section>
      </div>

      <aside className="min-w-0 space-y-4">
        <section className="sticky top-20 space-y-4 rounded-lg border border-line bg-white p-5 shadow-card">
          <h2 className="flex items-center gap-2 font-semibold text-ink"><Users className="size-4 text-redux-blue" aria-hidden /> Audience {previewing && <Loader2 className="size-4 animate-spin text-muted-ink" aria-hidden />}</h2>
          {preview && (
            <>
              <p className="num text-4xl font-semibold text-ink">{preview.eligible}</p>
              <p className="text-sm text-muted-ink">will receive it, of <span className="num">{preview.matched}</span> matched</p>
              <dl className="space-y-1 border-t border-line pt-3 text-sm">
                <div className="flex justify-between"><dt className="text-muted-ink">No marketing consent</dt><dd className="num">{preview.no_marketing_consent}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-ink">Weekly limit reached</dt><dd className="num">{preview.frequency_cap}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-ink">No {channel === 'email' ? 'email' : 'number'}</dt><dd className="num">{preview.no_address}</dd></div>
              </dl>
            </>
          )}
          <div className="space-y-1.5 border-t border-line pt-3"><Label htmlFor="c-when">Send later <span className="font-normal text-muted-ink">(optional)</span></Label><Input id="c-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending || !name || !template || !preview?.eligible} onClick={() => save(!when)}>{pending ? <Loader2 className="animate-spin" /> : <Send aria-hidden />} {when ? 'Schedule' : `Send to ${preview?.eligible ?? 0}`}</Button>
            <Button variant="outline" disabled={pending || !name || !template} onClick={() => save(false)}>Save draft</Button>
          </div>
          <p className="text-xs text-muted-ink">Messages respect quiet hours (21:00–09:00): sent tonight, they go at 9 am.</p>
        </section>
      </aside>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <fieldset><legend className="mb-1.5 text-sm font-medium text-ink">{label}</legend><div className="flex flex-wrap gap-1.5">{children}</div></fieldset>
}

export function CampaignActions({ id, status }: { id: string; status: string }) {
  const { pending, run } = useRun()
  if (!['draft', 'scheduled'].includes(status)) return null
  return (
    <div className="flex gap-2">
      <Button disabled={pending} onClick={() => run(async () => { const r = await launchCampaignAction(id); if (r.ok) toast.message(`${r.data.queued} queued · ${r.data.skipped} skipped`); return r }, 'Sent')}><Send aria-hidden /> Send now</Button>
      <Button variant="outline" disabled={pending} onClick={() => run(() => cancelCampaignAction(id), 'Cancelled')}>Cancel</Button>
    </div>
  )
}

export function SimulateReply({ phone }: { phone: string }) {
  const { pending, run } = useRun()
  return (
    <span className="inline-flex gap-1">
      <Button size="xs" variant="outline" disabled={pending} onClick={() => run(() => simulateReplyAction(phone, 'Yes, please call me'), 'Reply received')}><MessageSquareReply aria-hidden /> Reply “Yes”</Button>
      <Button size="xs" variant="ghost" disabled={pending} onClick={() => run(() => simulateReplyAction(phone, 'STOP'), 'Opted out')}>“STOP”</Button>
    </span>
  )
}

export function NewOffer() {
  const { pending, run } = useRun()
  const [open, setOpen] = useState(false)
  const [o, setO] = useState({ code: '', title: '', discount_pct: 10, valid_until: '', eligible_tiers: ['A', 'B', 'C'] as ('A' | 'B' | 'C')[], max_redemptions: null as number | null })
  return (
    <>
      <Button size="xs" variant="outline" onClick={() => setOpen(true)}><Plus aria-hidden /> New offer</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New offer</DialogTitle><DialogDescription>A code the team applies on a quotation. It replaces a smaller referral discount; it never adds to it.</DialogDescription></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="o-code">Code</Label><Input id="o-code" className="num uppercase" value={o.code} onChange={(e) => setO({ ...o, code: e.target.value.toUpperCase() })} placeholder="MONSOON10" /></div>
            <div className="space-y-1.5"><Label htmlFor="o-pct">Discount %</Label><Input id="o-pct" type="number" min={1} max={50} className="num" value={o.discount_pct} onChange={(e) => setO({ ...o, discount_pct: Number(e.target.value) })} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="o-title">Title</Label><Input id="o-title" value={o.title} onChange={(e) => setO({ ...o, title: e.target.value })} placeholder="Monsoon restoration offer" /></div>
            <div className="space-y-1.5"><Label htmlFor="o-until">Valid until</Label><Input id="o-until" type="date" value={o.valid_until} onChange={(e) => setO({ ...o, valid_until: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="o-max">Max uses <span className="font-normal text-muted-ink">(optional)</span></Label><Input id="o-max" type="number" min={1} className="num" value={o.max_redemptions ?? ''} onChange={(e) => setO({ ...o, max_redemptions: e.target.value === '' ? null : Number(e.target.value) })} /></div>
            <Field label="Tiers">{(['A', 'B', 'C'] as const).map((t) => <button key={t} type="button" aria-pressed={o.eligible_tiers.includes(t)} className={chip(o.eligible_tiers.includes(t))} onClick={() => setO({ ...o, eligible_tiers: toggle(o.eligible_tiers, t) })}>{t}</button>)}</Field>
          </div>
          <DialogFooter><Button disabled={pending} onClick={() => run(() => createOfferAction(o), 'Offer created', () => setOpen(false))}>{pending && <Loader2 className="animate-spin" />} Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function OfferToggle({ id, active }: { id: string; active: boolean }) {
  const { pending, run } = useRun()
  return <Button size="xs" variant="ghost" disabled={pending} onClick={() => run(() => setOfferActiveAction(id, !active), active ? 'Offer paused' : 'Offer active')}>{active ? 'Pause' : 'Activate'}</Button>
}
export function CadenceToggle({ id, active }: { id: string; active: boolean }) {
  const { pending, run } = useRun()
  return <Button size="xs" variant="ghost" disabled={pending} onClick={() => run(() => setCadenceActiveAction(id, !active), active ? 'Cadence off' : 'Cadence on')}>{active ? 'Turn off' : 'Turn on'}</Button>
}
