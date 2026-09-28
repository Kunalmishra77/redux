'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CopyPlus, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { issueQuoteAction, newVersionAction, setDiscountAction } from '@/lib/actions/quotes'

export function IssueButton({ quoteId }: { quoteId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button disabled={pending} onClick={() => start(async () => {
      const r = await issueQuoteAction(quoteId)
      if (r.ok) { toast.success('Issued — validity and terms frozen, PDF hashed, WhatsApp queued to the customer'); router.refresh() } else toast.error(r.message)
    })}>{pending ? <Loader2 className="animate-spin" /> : <Send aria-hidden />} Issue &amp; send</Button>
  )
}

export function NewVersionButton({ quoteId }: { quoteId: string }) {
  const [pending, start] = useTransition()
  return (
    <Button variant="outline" disabled={pending} onClick={() => start(async () => {
      const r = await newVersionAction(quoteId)
      if (r && !r.ok) toast.error(r.message)
    })}>{pending ? <Loader2 className="animate-spin" /> : <CopyPlus aria-hidden />} New version</Button>
  )
}

// BR-A6: above the threshold a reason is needed and the quote waits for the Super Admin
export function DiscountControl({ quoteId, current, threshold, isAdmin }: { quoteId: string; current: number; threshold: number; isAdmin: boolean }) {
  const router = useRouter()
  const [pct, setPct] = useState(String(current))
  const [reason, setReason] = useState('')
  const [pending, start] = useTransition()
  const n = Number(pct)
  const needsApproval = !isAdmin && n > threshold
  return (
    <div className="rounded-md bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="disc" className="text-sm">Discount</label>
        <span className="flex items-center gap-1">
          <Input id="disc" type="number" min={0} max={100} step={0.5} value={pct} onChange={(e) => setPct(e.target.value)} className="num h-8 w-20 text-right" />
          <span className="text-sm text-muted-ink">%</span>
        </span>
      </div>
      {needsApproval && (
        <>
          <p className="mt-2 text-xs text-warning">Above {threshold}% — this goes to the Super Admin for approval before the quote can be sent.</p>
          <Input className="mt-2 h-8" placeholder="Reason for the approver" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Discount reason" />
        </>
      )}
      <Button size="xs" variant="secondary" className="mt-2" disabled={pending || n === current || (needsApproval && !reason.trim())}
        onClick={() => start(async () => {
          const r = await setDiscountAction(quoteId, n, reason)
          if (r.ok) { toast.success(r.data.status === 'pending_approval' ? 'Sent for approval' : 'Discount applied'); router.refresh() } else toast.error(r.message)
        })}>Apply</Button>
    </div>
  )
}
