'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BellPlus, CalendarCheck, Check, Loader2, MapPin, MessageCircle, Phone, PhoneOff, StickyNote, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  addNoteAction, availableSurveyorsAction, bookSurveyAction, createFollowUpAction, logCallAction, markLostAction, reopenLeadAction,
} from '@/lib/actions/leads'
import { cn } from 'cn'

export type WorkLead = {
  id: string
  name: string | null
  phone: string
  status: string
  propertyName: string | null
  cityId: string | null
  cityName: string | null
  unitCount: number | null
  customerType: string | null
  hasOpenSurvey: boolean
}
export type Option = { code: string; name: string; requiresNote?: boolean }

const SLOTS = ['09:00', '11:00', '13:00', '15:00', '17:00']

function istIso(date: string, time: string) {
  return new Date(`${date}T${time}:00+05:30`).toISOString()
}

/**
 * D4 in one pane — UX principle 2: call → outcome → book the free survey → confirm, without
 * leaving the lead. Every action goes through a server action and the database's own rules.
 */
export function LeadWorkPane({ lead, outcomes, lostReasons, cities }: {
  lead: WorkLead
  outcomes: Option[]
  lostReasons: Option[]
  cities: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [calling, setCalling] = useState<number | null>(null)
  const [outcome, setOutcome] = useState<string>('')
  const [callNote, setCallNote] = useState('')
  const [lostOpen, setLostOpen] = useState(false)
  const [followOpen, setFollowOpen] = useState(false)

  const closed = lead.status === 'won' || lead.status === 'lost'
  const canBook = !closed && !lead.hasOpenSurvey && !['survey_booked', 'surveyed', 'quoted'].includes(lead.status)

  function run(fn: () => Promise<{ ok: boolean; message?: string }>, success: string) {
    start(async () => {
      const r = await fn()
      if (r.ok) { toast.success(success); router.refresh() } else toast.error(r.message ?? 'Something went wrong')
    })
  }

  function saveCall() {
    if (!outcome) { toast.error('Choose how the call went'); return }
    const secs = calling ? Math.round((Date.now() - calling) / 1000) : 0
    run(async () => {
      const r = await logCallAction({ leadId: lead.id, outcome, note: callNote, durationSec: secs })
      if (r.ok) { setCalling(null); setOutcome(''); setCallNote('') }
      return r
    }, 'Call logged')
  }

  return (
    <div className="space-y-5">
      {/* 1 — the call (the one lime action on the screen) */}
      <section aria-labelledby="call-h" className="rounded-lg border border-line bg-white p-5 shadow-card">
        <h3 id="call-h" className="eyebrow mb-3 text-muted-ink">1 · Call</h3>
        {closed ? (
          <p className="text-sm text-muted-ink">This lead is {lead.status === 'won' ? 'won — the job is running' : 'closed as lost'}.</p>
        ) : calling === null ? (
          <Button size="lg" className="w-full" asChild>
            <a href={`tel:${lead.phone}`} onClick={() => setCalling(Date.now())}>
              <Phone aria-hidden /> Call now · <span className="num">{lead.phone}</span>
            </a>
          </Button>
        ) : (
          <div className="flex items-center justify-between rounded-md bg-redux-blue px-4 py-3 text-white">
            <span className="flex items-center gap-2 text-sm font-semibold"><span className="size-2 animate-pulse rounded-full bg-redux-lime" /> On a call with {lead.name ?? lead.phone}</span>
            <Button size="sm" variant="outline" onClick={() => setCalling(null)} className="border-white/40 bg-transparent text-white hover:bg-white/10">
              <PhoneOff aria-hidden /> Hang up
            </Button>
          </div>
        )}
        {!closed && (
          <div className="mt-4 grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="outcome">Call outcome</Label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger id="outcome" className="h-10 w-full"><SelectValue placeholder="How did it go?" /></SelectTrigger>
                <SelectContent>{outcomes.map((o) => <SelectItem key={o.code} value={o.code}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {outcomes.find((o) => o.code === outcome)?.requiresNote && (
              <Input placeholder="What happened?" value={callNote} onChange={(e) => setCallNote(e.target.value)} aria-label="Outcome note" />
            )}
            <Button variant="secondary" onClick={saveCall} disabled={pending || !outcome}>
              {pending ? <Loader2 className="animate-spin" /> : <Check aria-hidden />} Log call
            </Button>
          </div>
        )}
      </section>

      {/* 2 — book the free survey inline */}
      <section aria-labelledby="book-h" className="rounded-lg border border-line bg-white p-5 shadow-card">
        <h3 id="book-h" className="eyebrow mb-3 text-muted-ink">2 · Book free survey</h3>
        {canBook ? <BookSurvey lead={lead} cities={cities} onDone={() => router.refresh()} />
          : <p className="flex items-center gap-2 text-sm text-muted-ink"><CalendarCheck className="size-4 text-success" aria-hidden />
              {closed ? 'Nothing to book.' : 'The free survey is booked — see the timeline.'}</p>}
      </section>

      {/* 3 — the rest */}
      <section className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => setFollowOpen(true)} disabled={closed}><BellPlus aria-hidden /> Follow-up</Button>
        <Button variant="outline" asChild><a href={`https://wa.me/${lead.phone.replace('+', '')}`} target="_blank" rel="noreferrer"><MessageCircle aria-hidden /> WhatsApp</a></Button>
        <NoteButton leadId={lead.id} />
        {lead.status === 'lost'
          ? <Button variant="outline" onClick={() => run(() => reopenLeadAction(lead.id), 'Lead reopened')} disabled={pending}>Reopen lead</Button>
          : <Button variant="destructive" onClick={() => setLostOpen(true)} disabled={closed}><XCircle aria-hidden /> Mark lost</Button>}
      </section>

      <LostDialog open={lostOpen} onOpenChange={setLostOpen} reasons={lostReasons}
        onConfirm={(reasonCode, note) => run(async () => { const r = await markLostAction({ leadId: lead.id, reasonCode, note }); if (r.ok) setLostOpen(false); return r }, 'Marked lost')} pending={pending} />
      <FollowUpDialog open={followOpen} onOpenChange={setFollowOpen}
        onConfirm={(dueAt, note) => run(async () => { const r = await createFollowUpAction({ leadId: lead.id, dueAt, note }); if (r.ok) setFollowOpen(false); return r }, 'Follow-up set')} pending={pending} />
    </div>
  )
}

function BookSurvey({ lead, cities, onDone }: { lead: WorkLead; cities: { id: string; name: string }[]; onDone: () => void }) {
  const [tomorrow] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + 86_400_000)))
  const [date, setDate] = useState(tomorrow)
  const [slot, setSlot] = useState('11:00')
  const [surveyors, setSurveyors] = useState<{ id: string; name: string; sameCity: boolean; load: number }[] | null>(null)
  const [surveyor, setSurveyor] = useState('')
  const [address, setAddress] = useState(lead.propertyName ? `${lead.propertyName}${lead.cityName ? `, ${lead.cityName}` : ''}` : '')
  const [cityId, setCityId] = useState(lead.cityId ?? '')
  const [pending, start] = useTransition()

  function findSurveyors(d = date, s = slot) {
    start(async () => {
      const list = await availableSurveyorsAction(istIso(d, s))
      setSurveyors(list)
      setSurveyor(list[0]?.id ?? '')
    })
  }

  function confirm() {
    start(async () => {
      const r = await bookSurveyAction({
        lead_id: lead.id, surveyor_id: surveyor, scheduled_at: istIso(date, slot),
        property: { name: lead.propertyName ?? undefined, address, city_id: cityId || undefined },
      })
      if (r.ok) { toast.success('Free survey booked — WhatsApp confirmation queued to the customer'); onDone() }
      else toast.error(r.message)
    })
  }

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="bk-date">Date</Label>
          <Input id="bk-date" type="date" min={tomorrow} value={date} onChange={(e) => { setDate(e.target.value); setSurveyors(null) }} className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bk-city">City</Label>
          <Select value={cityId} onValueChange={setCityId}>
            <SelectTrigger id="bk-city" className="h-10 w-full"><SelectValue placeholder="City" /></SelectTrigger>
            <SelectContent>{cities.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Slot</legend>
        <div className="flex flex-wrap gap-1.5">
          {SLOTS.map((s) => (
            <button key={s} type="button" onClick={() => { setSlot(s); setSurveyors(null) }} aria-pressed={slot === s}
              className={cn('num rounded-sm border px-2.5 py-1.5 text-xs font-semibold',
                slot === s ? 'border-redux-blue bg-redux-blue text-white' : 'border-line bg-white text-ink hover:border-redux-blue')}>
              {s}–{String(Number(s.slice(0, 2)) + 2).padStart(2, '0')}:00
            </button>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor="bk-address">Property address</Label>
        <Textarea id="bk-address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Building, street, area — the surveyor navigates here" />
      </div>
      {surveyors === null ? (
        <Button variant="outline" onClick={() => findSurveyors()} disabled={pending || !date}>
          {pending ? <Loader2 className="animate-spin" /> : <MapPin aria-hidden />} Find a free surveyor
        </Button>
      ) : surveyors.length === 0 ? (
        <p className="rounded-md bg-warning-bg px-3 py-2 text-sm text-warning">Every surveyor is booked in this slot — try another.</p>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="bk-surveyor">Surveyor</Label>
          <Select value={surveyor} onValueChange={setSurveyor}>
            <SelectTrigger id="bk-surveyor" className="h-10 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {surveyors.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name} · {s.sameCity ? 'same city' : 'other city'} · {s.load} that day</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <Button onClick={confirm} disabled={pending || !surveyor || address.trim().length < 5}>
        {pending ? <Loader2 className="animate-spin" /> : <CalendarCheck aria-hidden />} Confirm &amp; send WhatsApp
      </Button>
    </div>
  )
}

function NoteButton({ leadId }: { leadId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [pending, start] = useTransition()
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><StickyNote aria-hidden /> Add note</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add a note</DialogTitle><DialogDescription>Visible on the lead’s timeline to the team.</DialogDescription></DialogHeader>
          <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What should the next person know?" aria-label="Note" />
          <DialogFooter>
            <Button variant="secondary" disabled={pending || !body.trim()} onClick={() => start(async () => {
              const r = await addNoteAction(leadId, body)
              if (r.ok) { setOpen(false); setBody(''); toast.success('Note added'); router.refresh() } else toast.error(r.message)
            })}>Save note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function LostDialog({ open, onOpenChange, reasons, onConfirm, pending }: {
  open: boolean; onOpenChange: (o: boolean) => void; reasons: Option[]; onConfirm: (code: string, note?: string) => void; pending: boolean
}) {
  const [code, setCode] = useState('')
  const [note, setNote] = useState('')
  const needsNote = reasons.find((r) => r.code === code)?.requiresNote
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark as lost</DialogTitle>
          <DialogDescription>A reason is required. The lead can be reopened later — both events stay on the timeline.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2" role="radiogroup" aria-label="Lost reason">
          {reasons.map((r) => (
            <button key={r.code} type="button" role="radio" aria-checked={code === r.code} onClick={() => setCode(r.code)}
              className={cn('rounded-md border px-3 py-2.5 text-left text-sm', code === r.code ? 'border-redux-blue bg-select font-semibold text-redux-blue' : 'border-line hover:bg-surface')}>
              {r.name}
            </button>
          ))}
        </div>
        {needsNote && <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tell us more" aria-label="Lost note" />}
        <DialogFooter>
          <Button variant="destructive" disabled={pending || !code || (needsNote && !note.trim())} onClick={() => onConfirm(code, note)}>Mark lost</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FollowUpDialog({ open, onOpenChange, onConfirm, pending }: {
  open: boolean; onOpenChange: (o: boolean) => void; onConfirm: (dueAt: string, note?: string) => void; pending: boolean
}) {
  const [when, setWhen] = useState('')
  const [note, setNote] = useState('')
  const quick = [
    { label: 'In 2 hours', ms: 2 * 3_600_000 },
    { label: 'Tomorrow 11:00', ms: -1 },
    { label: 'In 3 days', ms: 3 * 86_400_000 },
  ]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Set a follow-up</DialogTitle><DialogDescription>It comes back to the top of your queue at that time.</DialogDescription></DialogHeader>
        <div className="flex flex-wrap gap-2">
          {quick.map((q) => (
            <Button key={q.label} variant="outline" size="sm" onClick={() => {
              const d = q.ms === -1 ? new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + 86_400_000))}T11:00:00+05:30`) : new Date(Date.now() + q.ms)
              // datetime-local shows local time: shift before formatting, not UTC
              setWhen(new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16))
            }}>{q.label}</Button>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fu-when">When</Label>
          <Input id="fu-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="h-10" />
        </div>
        <Input placeholder="Why? (optional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Follow-up note" />
        <DialogFooter>
          <Button variant="secondary" disabled={pending || !when} onClick={() => onConfirm(new Date(when).toISOString(), note)}>Set follow-up</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
