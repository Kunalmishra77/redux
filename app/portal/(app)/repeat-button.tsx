'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { requestRepeatAction } from '@/lib/actions/portal'

// D25 — "Request again": the same property and fittings come back to the team as a new enquiry.
export function RepeatButton({ jobId, propertyName }: { jobId: string; propertyName: string }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [pending, start] = useTransition()
  const send = () => start(async () => {
    const r = await requestRepeatAction(jobId, note)
    if (r.ok) { toast.success('Request sent — your REDUX contact will call you shortly'); setOpen(false); setNote('') } else toast.error(r.message)
  })
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}><RotateCcw aria-hidden /> Request again</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request the same work again</DialogTitle>
            <DialogDescription>For {propertyName}. We already have your rooms and fittings from this job, so you only need to tell us what’s different.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5"><Label htmlFor="rep-note">What do you need? (optional)</Label>
            <Textarea id="rep-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. The second floor this time — rooms 201 to 215" /></div>
          <DialogFooter><Button disabled={pending} onClick={send}>{pending && <Loader2 className="animate-spin" />} Send request</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
