'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FileX2, Loader2, Printer, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cancelInvoiceAction, issueInvoiceAction } from '@/lib/actions/invoices'

export function InvoiceActions({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  return (
    <>
      <Button variant="outline" onClick={() => window.print()}><Printer aria-hidden /> Print</Button>
      {status === 'draft' && (
        <Button disabled={pending} onClick={() => start(async () => {
          const r = await issueInvoiceAction(id)
          if (r.ok) { toast.success(`Issued as ${r.data.invoiceNo}`); router.refresh() } else toast.error(r.message)
        })}>{pending ? <Loader2 className="animate-spin" /> : <Send aria-hidden />} Issue invoice</Button>
      )}
      {status === 'issued' && <Button variant="outline" onClick={() => setOpen(true)}><FileX2 aria-hidden /> Cancel with credit note</Button>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this invoice</DialogTitle>
            <DialogDescription>An issued invoice is never edited or deleted. Cancelling raises a credit note for the full amount, with its own number.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5"><Label htmlFor="cn-reason">Reason</Label><Textarea id="cn-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="e.g. Billed to the wrong legal entity" /></div>
          <DialogFooter>
            <Button variant="destructive" disabled={pending || !reason.trim()} onClick={() => start(async () => {
              const r = await cancelInvoiceAction(id, reason)
              if (r.ok) { toast.success(`Credit note ${r.data.creditNo} raised`); setOpen(false); router.refresh() } else toast.error(r.message)
            })}>Raise credit note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
