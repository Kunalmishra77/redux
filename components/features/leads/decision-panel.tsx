'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Camera, Loader2, RefreshCw, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DEMO_LABEL, MODE_LABEL } from '@/lib/constants/assessment'
import { overrideAssessmentAction, overrideTierAction, rescoreLeadAction, startSelfAssessmentAction } from '@/lib/actions/scoring'

// CR-001 phase 4 (D27) — the lead's score, tier and assessment decision, with the overrides.


const select = 'h-10 w-full rounded-md border border-line bg-white px-2 text-sm'

export function DecisionControls({ leadId, isAdmin, tier, tierOverridden, mode, demoOffer, modeOverridden, selfSurveyId, canWork }: {
  leadId: string; isAdmin: boolean; tier: string | null; tierOverridden: boolean; mode: string | null; demoOffer: string | null
  modeOverridden: boolean; selfSurveyId: string | null; canWork: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [dlg, setDlg] = useState<null | 'tier' | 'mode'>(null)
  const [t, setT] = useState(tier ?? 'B')
  const [m, setM] = useState(mode ?? 'self')
  const [d, setD] = useState(demoOffer ?? 'none')
  const [reason, setReason] = useState('')

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, done: string) => start(async () => {
    const r = await fn()
    if (r.ok) { toast.success(done); setDlg(null); setReason(''); router.refresh() } else toast.error(r.message)
  })

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {canWork && <Button size="xs" variant="outline" disabled={pending} onClick={() => run(() => rescoreLeadAction(leadId), 'Rescored')}><RefreshCw aria-hidden /> Rescore</Button>}
      {isAdmin && <Button size="xs" variant="outline" onClick={() => setDlg('tier')}>Override tier</Button>}
      {canWork && <Button size="xs" variant="outline" onClick={() => setDlg('mode')}><SlidersHorizontal aria-hidden /> Change assessment</Button>}
      {(mode === 'self' || mode === 'video') && (selfSurveyId
        ? <Button size="xs" asChild><Link href={`/staff/surveys/${selfSurveyId}`}><Camera aria-hidden /> Open self-assessment</Link></Button>
        : canWork && <Button size="xs" disabled={pending} onClick={() => run(() => startSelfAssessmentAction(leadId, mode as 'self' | 'video'), 'Self-assessment link sent on WhatsApp')}><Camera aria-hidden /> Send self-assessment</Button>)}

      <Dialog open={dlg === 'tier'} onOpenChange={(o) => setDlg(o ? 'tier' : null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Override tier</DialogTitle><DialogDescription>Stays in place when the lead is rescored, until you clear it. Recorded in the audit log.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">{(['A', 'B', 'C'] as const).map((x) => <button key={x} type="button" aria-pressed={t === x} onClick={() => setT(x)} className={`num h-10 w-12 rounded-md text-sm font-bold ring-1 ${t === x ? 'bg-redux-blue text-white ring-redux-blue' : 'text-ink ring-line'}`}>{x}</button>)}</div>
            <div className="space-y-1.5"><Label htmlFor="tier-why">Reason</Label><Textarea id="tier-why" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Budget confirmed by the GM on the call" /></div>
          </div>
          <DialogFooter className="gap-2">
            {tierOverridden && <Button variant="outline" disabled={pending} onClick={() => run(() => overrideTierAction(leadId, null, ''), 'Override cleared')}>Clear override</Button>}
            <Button disabled={pending || reason.trim().length < 3} onClick={() => run(() => overrideTierAction(leadId, t as 'A' | 'B' | 'C', reason), `Tier set to ${t}`)}>{pending && <Loader2 className="animate-spin" />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dlg === 'mode'} onOpenChange={(o) => setDlg(o ? 'mode' : null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change the assessment</DialogTitle><DialogDescription>Overrides the policy for this lead. Give the reason — it is kept with the lead.</DialogDescription></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="am-mode">Assessment</Label>
              <select id="am-mode" className={select} value={m} onChange={(e) => setM(e.target.value)}>{Object.entries(MODE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div className="space-y-1.5"><Label htmlFor="am-demo">Demo offer</Label>
              <select id="am-demo" className={select} value={d} onChange={(e) => setD(e.target.value)}>{Object.entries(DEMO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="am-why">Reason</Label><Textarea id="am-why" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Chain flagship — the GM wants us on site" /></div>
          </div>
          <DialogFooter className="gap-2">
            {modeOverridden && <Button variant="outline" disabled={pending} onClick={() => run(() => overrideAssessmentAction(leadId, null, null, ''), 'Back to the policy')}>Use the policy</Button>}
            <Button disabled={pending || reason.trim().length < 3} onClick={() => run(() => overrideAssessmentAction(leadId, m as 'onsite', d as 'none', reason), 'Assessment changed')}>{pending && <Loader2 className="animate-spin" />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
