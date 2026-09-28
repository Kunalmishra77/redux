'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { recordMovementAction, type MovementInput } from '@/lib/actions/operations'

const TYPES: { key: MovementInput['type']; label: string; hint: string }[] = [
  { key: 'in', label: 'Received', hint: 'Stock in from Eurobrass or a supplier' },
  { key: 'consumed', label: 'Used on a job', hint: 'Fitted during a restoration' },
  { key: 'out', label: 'Issued out', hint: 'Returned, sent back, written off' },
  { key: 'adjusted', label: 'Adjust count', hint: 'Physical count correction (+ or −)' },
]

export function MovementButton({ items, jobs }: { items: { id: string; label: string; uom: string; quantity: number }[]; jobs: { id: string; job_no: string }[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [item, setItem] = useState('')
  const [type, setType] = useState<MovementInput['type']>('in')
  const [qty, setQty] = useState('')
  const [job, setJob] = useState('')
  const [reason, setReason] = useState('')
  const [pending, start] = useTransition()
  const it = items.find((i) => i.id === item)
  const ok = item && Number(qty) !== 0 && qty !== '' && (type !== 'consumed' || job) && (type !== 'adjusted' || reason.trim())
  const submit = () => start(async () => {
    const r = await recordMovementAction({ item_id: item, type, quantity: Number(qty), job_id: type === 'consumed' ? job : undefined, reason: reason || undefined })
    if (r.ok) { toast.success('Movement recorded'); setOpen(false); setQty(''); setReason(''); router.refresh() } else toast.error(r.message)
  })
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus aria-hidden /> Record movement</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record a stock movement</DialogTitle>
            <DialogDescription>The quantity changes only through a movement — who, what, why — so the count always has a history.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="mv-item">Item</Label>
              <Select value={item} onValueChange={setItem}>
                <SelectTrigger id="mv-item" className="h-10 w-full"><SelectValue placeholder="Choose an item" /></SelectTrigger>
                <SelectContent>{items.map((i) => <SelectItem key={i.id} value={i.id}>{i.label}</SelectItem>)}</SelectContent>
              </Select>
              {it && <p className="text-xs text-muted-ink">In stock: <span className="num font-semibold text-ink">{it.quantity}</span> {it.uom}</p>}
            </div>
            <fieldset className="grid grid-cols-2 gap-2">
              <legend className="mb-1.5 text-sm font-medium">Movement</legend>
              {TYPES.map((t) => (
                <button key={t.key} type="button" onClick={() => setType(t.key)} aria-pressed={type === t.key}
                  className={`rounded-md border p-2.5 text-left text-sm ${type === t.key ? 'border-redux-blue bg-select' : 'border-line hover:bg-surface'}`}>
                  <span className="block font-semibold text-ink">{t.label}</span><span className="text-xs text-muted-ink">{t.hint}</span>
                </button>
              ))}
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="mv-qty">Quantity{type === 'adjusted' ? ' (+/−)' : ''}</Label>
                <Input id="mv-qty" type="number" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className="num" /></div>
              {type === 'consumed' && (
                <div className="space-y-1.5"><Label htmlFor="mv-job">Job</Label>
                  <Select value={job} onValueChange={setJob}>
                    <SelectTrigger id="mv-job" className="h-10 w-full"><SelectValue placeholder="Which job?" /></SelectTrigger>
                    <SelectContent>{jobs.map((j) => <SelectItem key={j.id} value={j.id}>{j.job_no}</SelectItem>)}</SelectContent>
                  </Select></div>
              )}
            </div>
            <div className="space-y-1.5"><Label htmlFor="mv-reason">Reason {type === 'adjusted' ? '(required)' : '(optional)'}</Label>
              <Input id="mv-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={type === 'in' ? 'e.g. PO 1142 from Eurobrass' : 'e.g. Monthly count'} /></div>
          </div>
          <DialogFooter><Button disabled={!ok || pending} onClick={submit}>{pending && <Loader2 className="animate-spin" />} Record</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
