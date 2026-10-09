'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, MessageSquareWarning, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { assignReviewerAction, priceFittingAction, requestSelfAssessmentInfoAction } from '@/lib/actions/scoring'

// CR-001 phase 4 (D27) — the reviewer's side of a self-assessment (BR-S10, BR-S11, ADR-015).

const sel = 'h-9 w-full rounded-md border border-line bg-white px-2 text-sm'
const TREATMENTS = [['restore_finish', 'Restore finish'], ['repair_function', 'Repair function'], ['replace_eurobrass', 'Replace (Eurobrass)'], ['no_action', 'No action']] as const

/** One fitting's recommendation, priced on the server from the active rate card. */
export function PriceFitting({ surveyId, fittingId, finishes, current }: {
  surveyId: string; fittingId: string; finishes: { id: string; name: string }[]
  current: { recommended: string; finish_id: string | null; note: string | null } | null
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(!current)
  const [rec, setRec] = useState(current?.recommended ?? 'restore_finish')
  const [finish, setFinish] = useState(current?.finish_id ?? '')
  const [note, setNote] = useState(current?.note ?? '')
  const [manual, setManual] = useState(false)
  const [price, setPrice] = useState('')
  const [reason, setReason] = useState('')
  const save = () => start(async () => {
    const r = await priceFittingAction(surveyId, {
      fittingId, recommended: rec as 'restore_finish', finishId: finish || null, note,
      override: manual ? { reason, price: Number(price) } : null,
    })
    if (r.ok) { toast.success('Priced'); setOpen(false); router.refresh() } else toast.error(r.message)
  })
  if (!open) return <Button size="xs" variant="outline" className="mt-3" onClick={() => setOpen(true)}><Tag aria-hidden /> Change recommendation</Button>
  return (
    <div className="mt-3 space-y-2 border-t border-line pt-3">
      <p className="eyebrow text-muted-ink">{current ? 'Change recommendation' : 'Your recommendation'}</p>
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="Recommendation" className={sel} value={rec} onChange={(e) => setRec(e.target.value)}>{TREATMENTS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select aria-label="Finish" className={sel} value={finish} onChange={(e) => setFinish(e.target.value)}><option value="">Same finish</option>{finishes.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
      </div>
      <Input aria-label="Note for the customer" className="h-9" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
      <label className="flex items-center gap-1.5 text-xs text-muted-ink"><input type="checkbox" className="size-3.5 accent-redux-blue" checked={manual} onChange={(e) => setManual(e.target.checked)} /> Manual price (not on the rate card)</label>
      {manual && (
        <div className="grid grid-cols-[7rem_1fr] gap-2">
          <Input aria-label="Manual price" type="number" className="num h-9" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="₹" />
          <Input aria-label="Reason for manual price" className="h-9" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" />
        </div>
      )}
      <div className="flex gap-2">
        <Button size="xs" disabled={pending} onClick={save}>{pending && <Loader2 className="animate-spin" />} Price it</Button>
        {current && <Button size="xs" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>}
      </div>
    </div>
  )
}

export function AskForInfo({ surveyId }: { surveyId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [pending, start] = useTransition()
  const send = () => start(async () => {
    const r = await requestSelfAssessmentInfoAction(surveyId, text)
    if (r.ok) { toast.success('Sent to the customer on WhatsApp — the self-assessment is open again'); setOpen(false); setText(''); router.refresh() } else toast.error(r.message)
  })
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}><MessageSquareWarning aria-hidden /> Ask for more</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ask the customer for more</DialogTitle><DialogDescription>Reopens the self-assessment and sends this on WhatsApp with the link. The 24-hour clock restarts when they submit again.</DialogDescription></DialogHeader>
          <div className="space-y-1.5"><Label htmlFor="ask-text">What do you need?</Label><Textarea id="ask-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. A clearer close-up of the shower mixer in room 204 — the chrome edge is blurred" /></div>
          <DialogFooter><Button disabled={pending || text.trim().length < 5} onClick={send}>{pending && <Loader2 className="animate-spin" />} Send</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function ReviewerSelect({ surveyId, current, people }: { surveyId: string; current: string | null; people: { id: string; full_name: string }[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <select aria-label="Reviewer" disabled={pending} className={sel} value={current ?? ''} onChange={(e) => start(async () => {
      const r = await assignReviewerAction(surveyId, e.target.value || null)
      if (r.ok) { toast.success('Reviewer set'); router.refresh() } else toast.error(r.message)
    })}>
      <option value="">Not assigned (Super Admin)</option>{people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
    </select>
  )
}
