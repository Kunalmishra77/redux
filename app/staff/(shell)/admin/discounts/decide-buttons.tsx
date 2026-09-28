'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { decideDiscountAction } from '@/lib/actions/quotes'

export function DecideButtons({ approvalId }: { approvalId: string }) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [pending, start] = useTransition()
  const decide = (approve: boolean) => start(async () => {
    const r = await decideDiscountAction(approvalId, approve, note || undefined)
    if (r.ok) { toast.success(approve ? 'Approved — the quote can now be sent' : 'Rejected — the quote is back to draft'); router.refresh() } else toast.error(r.message)
  })
  return (
    <div className="mt-4 space-y-2">
      <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Decision note" />
      <div className="flex gap-2">
        <Button className="flex-1" disabled={pending} onClick={() => decide(true)}><Check aria-hidden /> Approve</Button>
        <Button variant="outline" className="flex-1" disabled={pending} onClick={() => decide(false)}><X aria-hidden /> Reject</Button>
      </div>
    </div>
  )
}
