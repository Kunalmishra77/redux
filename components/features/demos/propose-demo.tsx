'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Gift, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { proposeDemoAction } from '@/lib/actions/demos'

// CR-001 phase 5 (D28) — propose a free demo from the lead or the account. The Super Admin approves
// every one (BR-D1); outside the tier rule or a second demo needs a reason (BR-D2).

type Candidate = { id: string; unit: string; type: string; site: string; recommended: string | null }
const TYPES = { room_demo: { name: 'Room demo', max: 8, hint: 'Every fitting in one room' }, fitting_demo: { name: 'Single-fitting demo', max: 1, hint: 'One fitting' } } as const
const REC: Record<string, string> = { restore_finish: 'restore', repair_function: 'repair', replace_eurobrass: 'replace', no_action: 'no action' }

export function ProposeDemoButton({ customerId, leadId, offer, tier, candidates, size = 'xs' }: {
  customerId: string; leadId: string | null; offer: string | null; tier: string | null; candidates: Candidate[]; size?: 'xs' | 'sm'
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<keyof typeof TYPES>(offer === 'fitting_demo' ? 'fitting_demo' : 'room_demo')
  const [picked, setPicked] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [pending, start] = useTransition()
  const offered = offer === type
  const toggle = (id: string) => {
    const unit = candidates.find((c) => c.id === id)?.unit
    setPicked((p) => p.includes(id) ? p.filter((x) => x !== id)
      : type === 'fitting_demo' ? [id]
      : [...p.filter((x) => candidates.find((c) => c.id === x)?.unit === unit), id])   // one room
  }
  const submit = () => start(async () => {
    const r = await proposeDemoAction({ customerId, leadId, type, fittingIds: picked, note, exceptionReason: reason || undefined })
    if (r.ok) { toast.success('Proposed — waiting for the Super Admin'); setOpen(false); setPicked([]); router.push(`/staff/demos/${r.data.id}`) } else toast.error(r.message)
  })
  return (
    <>
      <Button size={size} variant={offer && offer !== 'none' ? 'default' : 'outline'} onClick={() => setOpen(true)}><Gift aria-hidden /> Propose demo</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Propose a free demo</DialogTitle>
            <DialogDescription>Free, and separate from a paid pilot. The Super Admin approves every demo before it is scheduled.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(TYPES) as (keyof typeof TYPES)[]).map((k) => (
                <button key={k} type="button" aria-pressed={type === k} onClick={() => { setType(k); setPicked([]) }}
                  className={`rounded-lg p-3 text-left ring-1 ${type === k ? 'bg-redux-blue text-white ring-redux-blue' : 'ring-line hover:bg-surface'}`}>
                  <span className="block text-sm font-semibold">{TYPES[k].name}</span>
                  <span className={`block text-xs ${type === k ? 'text-white/80' : 'text-muted-ink'}`}>{TYPES[k].hint}{offer === k ? ' · offered by policy' : ''}</span>
                </button>
              ))}
            </div>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-ink">Fittings {type === 'room_demo' ? '(one room)' : '(one)'}</legend>
              {candidates.length ? (
                <ul className="max-h-60 space-y-1 overflow-y-auto rounded-md border border-line p-1">
                  {candidates.map((c) => (
                    <li key={c.id}><label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-surface">
                      <input type="checkbox" className="size-4 accent-redux-blue" checked={picked.includes(c.id)} onChange={() => toggle(c.id)} />
                      <span className="flex-1"><span className="font-medium text-ink">{/^\d/.test(c.unit) ? `Room ${c.unit}` : c.unit}</span> · {c.type}</span>
                      {c.recommended && <span className="text-xs text-muted-ink">{REC[c.recommended]}</span>}
                    </label></li>
                  ))}
                </ul>
              ) : <p className="rounded-md bg-surface p-3 text-sm text-muted-ink">No assessed fittings yet. A demo is chosen from the account’s assessment — send a self-assessment or book a survey first.</p>}
            </fieldset>
            {!offered && (
              <div className="space-y-1.5"><Label htmlFor="demo-why">Why this demo? <span className="font-normal text-muted-ink">(needed outside the {tier ? `tier ${tier} ` : ''}policy, or for a second demo)</span></Label>
                <Textarea id="demo-why" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Owner runs four hotels; a room demo decides the chain" /></div>
            )}
            <div className="space-y-1.5"><Label htmlFor="demo-note">Note for the approver <span className="font-normal text-muted-ink">(optional)</span></Label>
              <Textarea id="demo-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          </div>
          <DialogFooter><Button disabled={pending || picked.length === 0} onClick={submit}>{pending && <Loader2 className="animate-spin" />} Send for approval</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
