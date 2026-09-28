'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, CheckCheck, Loader2, PlayCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { progressServiceRequestAction } from '@/lib/actions/operations'

// The request moves forward only: open → acknowledged → in progress → resolved (with a note) → closed.
export function SrActions({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [note, setNote] = useState('')
  const go = (to: string, ok: string) => start(async () => {
    const r = await progressServiceRequestAction(id, to, note)
    if (r.ok) { toast.success(ok); setNote(''); router.refresh() } else toast.error(r.message)
  })
  if (status === 'open') return <Button size="sm" disabled={pending} onClick={() => go('acknowledged', 'Acknowledged — the customer is told on WhatsApp')}>{pending ? <Loader2 className="animate-spin" /> : <Check aria-hidden />} Acknowledge</Button>
  if (status === 'acknowledged') return <Button size="sm" variant="secondary" disabled={pending} onClick={() => go('in_progress', 'Marked in progress')}><PlayCircle aria-hidden /> Start work</Button>
  if (status === 'resolved') return <Button size="sm" variant="outline" disabled={pending} onClick={() => go('closed', 'Closed')}><XCircle aria-hidden /> Close</Button>
  return (
    <div className="flex flex-wrap gap-2">
      <Input className="h-9 min-w-64 flex-1" placeholder="How was it resolved?" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Resolution note" />
      <Button size="sm" disabled={pending || !note.trim()} onClick={() => go('resolved', 'Resolved')}><CheckCheck aria-hidden /> Resolve</Button>
    </div>
  )
}
