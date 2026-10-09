'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarDays, Check, Loader2, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { closeDemoAction, decideDemoAction, recordDemoOutcomeAction, saveDemoTypeAction, scheduleDemoAction } from '@/lib/actions/demos'

// CR-001 phase 5 (D28) — the steps of a demo: approve (Super Admin), schedule, record the outcome and
// cost, close. Each calls one database function (BR-D1…D4).

function useRun() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, done: string, after?: () => void) => start(async () => {
    const r = await fn()
    if (r.ok) { toast.success(done); after?.(); router.refresh() } else toast.error(r.message)
  })
  return { pending, run }
}

export function DecideDemo({ demoId }: { demoId: string }) {
  const { pending, run } = useRun()
  const [reject, setReject] = useState(false)
  const [note, setNote] = useState('')
  return (
    <div className="flex flex-wrap gap-2">
      <Button disabled={pending} onClick={() => run(() => decideDemoAction(demoId, true, ''), 'Approved — the team can schedule it')}><Check aria-hidden /> Approve</Button>
      <Button variant="outline" disabled={pending} onClick={() => setReject(true)}><X aria-hidden /> Reject</Button>
      <Dialog open={reject} onOpenChange={setReject}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject this demo</DialogTitle><DialogDescription>The executive who proposed it sees your reason.</DialogDescription></DialogHeader>
          <div className="space-y-1.5"><Label htmlFor="rej-why">Reason</Label><Textarea id="rej-why" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Offer a single-fitting demo first" /></div>
          <DialogFooter><Button disabled={pending || note.trim().length < 3} onClick={() => run(() => decideDemoAction(demoId, false, note), 'Rejected', () => setReject(false))}>{pending && <Loader2 className="animate-spin" />} Reject</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function ScheduleDemo({ demoId, today }: { demoId: string; today: string }) {
  const { pending, run } = useRun()
  const [date, setDate] = useState('')
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1.5"><Label htmlFor="demo-date">Demo date</Label><Input id="demo-date" type="date" min={today} className="w-44" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <Button disabled={pending || !date} onClick={() => run(() => scheduleDemoAction(demoId, date), 'Scheduled — job opened and the customer told on WhatsApp')}>
        {pending ? <Loader2 className="animate-spin" /> : <CalendarDays aria-hidden />} Schedule
      </Button>
    </div>
  )
}

export function DemoOutcome({ demoId, isAdmin, value }: { demoId: string; isAdmin: boolean; value: { result: string | null; internal_cost: number | null; feedback: string | null } }) {
  const { pending, run } = useRun()
  const [result, setResult] = useState(value.result ?? '')
  const [cost, setCost] = useState(value.internal_cost === null ? '' : String(value.internal_cost))
  const [feedback, setFeedback] = useState(value.feedback ?? '')
  const save = () => run(() => recordDemoOutcomeAction(demoId, {
    ...(result ? { result: result as 'pass' } : {}),
    ...(isAdmin && cost !== '' ? { internal_cost: Number(cost) } : {}),
    feedback,
  }), 'Saved')
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="demo-result">Result</Label>
          <select id="demo-result" className="h-10 w-full rounded-md border border-line bg-white px-2 text-sm" value={result} onChange={(e) => setResult(e.target.value)}>
            <option value="">Not recorded</option><option value="pass">Customer satisfied</option><option value="needs_work">Needs more work</option>
          </select></div>
        {isAdmin && <div className="space-y-1.5"><Label htmlFor="demo-cost">Internal cost (₹)</Label><Input id="demo-cost" type="number" min={0} className="num" value={cost} onChange={(e) => setCost(e.target.value)} /></div>}
      </div>
      <div className="space-y-1.5"><Label htmlFor="demo-fb">What the customer said</Label><Textarea id="demo-fb" rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} /></div>
      <Button size="sm" disabled={pending} onClick={save}>{pending ? <Loader2 className="animate-spin" /> : <Save aria-hidden />} Save</Button>
    </div>
  )
}

export function CloseDemo({ demoId, outcome }: { demoId: string; outcome: 'not_converted' | 'cancelled' }) {
  const { pending, run } = useRun()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const label = outcome === 'cancelled' ? 'Cancel demo' : 'Close — no order'
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>{label}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{label}</DialogTitle><DialogDescription>{outcome === 'cancelled' ? 'The demo will not happen. Its job, if opened, is cancelled.' : 'The demo is done but did not lead to an order. It stays in the conversion numbers.'}</DialogDescription></DialogHeader>
          <div className="space-y-1.5"><Label htmlFor="close-note">Note</Label><Textarea id="close-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <DialogFooter><Button disabled={pending || note.trim().length < 3} onClick={() => run(() => closeDemoAction(demoId, outcome, note), 'Closed', () => setOpen(false))}>{pending && <Loader2 className="animate-spin" />} {label}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

type DemoType = { id: string; name: string; max_units: number; max_fittings: number; cost_cap: number | null; eligible_tiers: string[]; is_active: boolean }
export function DemoTypeRow({ type, editable }: { type: DemoType; editable: boolean }) {
  const { pending, run } = useRun()
  const [t, setT] = useState(type)
  const dirty = JSON.stringify(t) !== JSON.stringify(type)
  const tier = (x: string) => setT({ ...t, eligible_tiers: t.eligible_tiers.includes(x) ? t.eligible_tiers.filter((y) => y !== x) : [...t.eligible_tiers, x].sort() })
  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-2 py-2 font-medium text-ink">{t.name}</td>
      <td className="px-2 py-2"><Input aria-label="Rooms" type="number" min={1} disabled={!editable} className="num h-9 w-16" value={t.max_units} onChange={(e) => setT({ ...t, max_units: Number(e.target.value) })} /></td>
      <td className="px-2 py-2"><Input aria-label="Fittings" type="number" min={1} disabled={!editable} className="num h-9 w-16" value={t.max_fittings} onChange={(e) => setT({ ...t, max_fittings: Number(e.target.value) })} /></td>
      <td className="px-2 py-2"><Input aria-label="Cost guide" type="number" min={0} disabled={!editable} className="num h-9 w-28" value={t.cost_cap ?? ''} onChange={(e) => setT({ ...t, cost_cap: e.target.value === '' ? null : Number(e.target.value) })} /></td>
      <td className="px-2 py-2"><span className="flex gap-1">{['A', 'B', 'C'].map((x) => <button key={x} type="button" disabled={!editable} aria-pressed={t.eligible_tiers.includes(x)} onClick={() => tier(x)} className={`num size-8 rounded-md text-xs font-bold ring-1 ${t.eligible_tiers.includes(x) ? 'bg-redux-blue text-white ring-redux-blue' : 'text-muted-ink ring-line'}`}>{x}</button>)}</span></td>
      <td className="px-2 py-2"><input aria-label="Active" type="checkbox" disabled={!editable} className="size-4 accent-redux-blue" checked={t.is_active} onChange={(e) => setT({ ...t, is_active: e.target.checked })} /></td>
      <td className="px-2 py-2">{editable && <Button size="xs" variant="outline" disabled={pending || !dirty} onClick={() => run(() => saveDemoTypeAction(t.id, t), 'Demo type saved')}><Save aria-hidden /> Save</Button>}</td>
    </tr>
  )
}
