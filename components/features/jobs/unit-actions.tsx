'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowRight, Ban, ClipboardCheck, Loader2, MoreHorizontal, Undo2, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { JOB_STAGES } from '@/components/patterns'
import { BLOCK_REASONS } from '@/lib/constants/statuses'
import { blockUnitAction, moveStageAction, unblockUnitAction } from '@/lib/actions/jobs'
import type { Result } from '@/lib/result'

type Stage = (typeof JOB_STAGES)[number]['key']

// B23 per-room controls. Stages go forward one at a time; back needs a reason (BR-J1). Handover and
// warranty come only from the handover checks (D11-07).
export function UnitActions({ jobId, unitId, label, stage, status, isAdmin, canHandover }: {
  jobId: string; unitId: string; label: string; stage: Stage; status: string; isAdmin: boolean; canHandover: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [dialog, setDialog] = useState<'back' | 'block' | null>(null)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const at = JOB_STAGES.findIndex((s) => s.key === stage)
  const next = JOB_STAGES[at + 1]
  const prev = JOB_STAGES[at - 1]
  const run = (fn: () => Promise<Result<null>>, ok: string) => start(async () => {
    const r = await fn()
    if (r.ok) { toast.success(ok); setDialog(null); setReason(''); setNote(''); router.refresh() } else toast.error(r.message)
  })
  const done = stage === 'handover' || stage === 'warranty_active'
  if (done) return <span className="text-xs text-success">Warranty active</span>

  return (
    <div className="flex items-center justify-end gap-1.5">
      {status === 'blocked' ? (
        (isAdmin || canHandover) && <Button size="xs" variant="outline" disabled={pending} onClick={() => run(() => unblockUnitAction(jobId, unitId), `Room ${label} unblocked — the clock runs again`)}><Unlock aria-hidden /> Unblock</Button>
      ) : stage === 'refit_test' ? (
        canHandover && <Button size="xs" asChild><Link href={`/staff/jobs/${jobId}/handover?unit=${unitId}`}><ClipboardCheck aria-hidden /> Handover</Link></Button>
      ) : (
        isAdmin && next && <Button size="xs" variant="secondary" disabled={pending} onClick={() => run(() => moveStageAction(jobId, unitId, next.key), `Room ${label} → ${next.label}`)}>
          {pending ? <Loader2 className="animate-spin" /> : <ArrowRight aria-hidden />} {next.label}</Button>
      )}
      {(isAdmin || canHandover) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="icon-xs" variant="ghost" aria-label={`More for room ${label}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {status !== 'blocked' && <DropdownMenuItem onSelect={() => setDialog('block')}><Ban aria-hidden /> Mark blocked</DropdownMenuItem>}
            {isAdmin && prev && status !== 'blocked' && <DropdownMenuItem onSelect={() => setDialog('back')}><Undo2 aria-hidden /> Move back to {prev.label}</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          {dialog === 'block' ? (
            <>
              <DialogHeader>
                <DialogTitle>Block room {label}</DialogTitle>
                <DialogDescription>The delay clock stops while a room is blocked, and the room board shows who it’s waiting on.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5"><Label htmlFor="blk-reason">Waiting on</Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger id="blk-reason" className="h-10 w-full"><SelectValue placeholder="Choose a reason" /></SelectTrigger>
                    <SelectContent>{Object.entries(BLOCK_REASONS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label} ({v.on})</SelectItem>)}</SelectContent>
                  </Select></div>
                <div className="space-y-1.5"><Label htmlFor="blk-note">Note {reason === 'other' ? '(required)' : '(optional)'}</Label>
                  <Input id="blk-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Tiling in progress, hotel says Friday" /></div>
              </div>
              <DialogFooter>
                <Button variant="destructive" disabled={pending || !reason || (reason === 'other' && !note.trim())}
                  onClick={() => run(() => blockUnitAction(jobId, unitId, reason, note), `Room ${label} blocked — clock stopped`)}>Block room</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Move room {label} back</DialogTitle>
                <DialogDescription>Back to {prev?.label}. The reason is recorded on the job timeline.</DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5"><Label htmlFor="back-reason">Reason</Label>
                <Input id="back-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Finish failed QC — re-plating" /></div>
              <DialogFooter>
                <Button disabled={pending || !reason.trim()} onClick={() => prev && run(() => moveStageAction(jobId, unitId, prev.key, reason), `Room ${label} moved back`)}>Move back</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
