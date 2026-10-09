'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Link2, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { recordReferralAction, redeemRewardAction, rejectReferralAction, saveReferralProgrammeAction } from '@/lib/actions/referrals'

// CR-001 phase 6 (D29) — staff controls for referrals and the reward ledger (BR-R1…R6)

function useRun() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, done: string, after?: () => void) => start(async () => {
    const r = await fn()
    if (r.ok) { toast.success(done); after?.(); router.refresh() } else toast.error(r.message)
  })
  return { pending, run }
}

/** Pick the referring account for a lead (or account) — searchable by name. */
export function LinkReferral({ leadId, customerId, accounts, hint = '', label = 'Link referrer' }: {
  leadId: string | null; customerId: string | null; accounts: { id: string; name: string }[]; hint?: string; label?: string
}) {
  const { pending, run } = useRun()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState(hint)
  const [pick, setPick] = useState<string | null>(null)
  const matches = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
    return (words.length ? accounts.filter((a) => words.some((w) => a.name.toLowerCase().includes(w))) : accounts).slice(0, 12)
  }, [q, accounts])
  return (
    <>
      <Button size="xs" variant="outline" onClick={() => setOpen(true)}><Link2 aria-hidden /> {label}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Who referred them?</DialogTitle><DialogDescription>The referrer earns credit when this business pays its first order. Branches of the same chain can refer each other.</DialogDescription></DialogHeader>
          <Input aria-label="Search accounts" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by account name" />
          <ul className="max-h-60 space-y-1 overflow-y-auto">
            {matches.map((a) => (
              <li key={a.id}><button type="button" aria-pressed={pick === a.id} onClick={() => setPick(a.id)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${pick === a.id ? 'bg-redux-blue text-white' : 'hover:bg-surface'}`}>{a.name}</button></li>
            ))}
            {!matches.length && <li className="px-3 py-2 text-sm text-muted-ink">No account matches.</li>}
          </ul>
          <DialogFooter><Button disabled={pending || !pick} onClick={() => run(() => recordReferralAction(pick!, leadId, customerId), 'Referral recorded', () => setOpen(false))}>{pending && <Loader2 className="animate-spin" />} Link</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function RejectReferral({ referralId }: { referralId: string }) {
  const { pending, run } = useRun()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  return (
    <>
      <Button size="xs" variant="ghost" onClick={() => setOpen(true)}>Reject</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject this referral</DialogTitle><DialogDescription>No discount for the referred business and no reward for the referrer.</DialogDescription></DialogHeader>
          <div className="space-y-1.5"><Label htmlFor="rr-why">Reason</Label><Textarea id="rr-why" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Already our customer before the referral" /></div>
          <DialogFooter><Button disabled={pending || reason.trim().length < 3} onClick={() => run(() => rejectReferralAction(referralId, reason), 'Rejected', () => setOpen(false))}>{pending && <Loader2 className="animate-spin" />} Reject</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function RedeemReward({ rewardId, kind, invoices, quotations }: { rewardId: string; kind: string; invoices: { id: string; label: string }[]; quotations: { id: string; label: string }[] }) {
  const { pending, run } = useRun()
  const [open, setOpen] = useState(false)
  const options = kind === 'credit' ? invoices : quotations
  const [target, setTarget] = useState('')
  const [note, setNote] = useState('')
  return (
    <>
      <Button size="xs" onClick={() => setOpen(true)}>Use</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{kind === 'credit' ? 'Apply the credit' : 'Give the free fitting'}</DialogTitle>
            <DialogDescription>{kind === 'credit' ? 'The credit settles part of an issued invoice of the same account. The tax invoice itself does not change.' : 'Record the quotation the free fitting is given on. A reward is used once.'}</DialogDescription></DialogHeader>
          {options.length ? (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label htmlFor="rd-target">{kind === 'credit' ? 'Invoice' : 'Quotation'}</Label>
                <select id="rd-target" className="h-10 w-full rounded-md border border-line bg-white px-2 text-sm" value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="">Choose…</option>{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select></div>
              <div className="space-y-1.5"><Label htmlFor="rd-note">Note <span className="font-normal text-muted-ink">(optional)</span></Label><Input id="rd-note" value={note} onChange={(e) => setNote(e.target.value)} /></div>
            </div>
          ) : <p className="text-sm text-muted-ink">{kind === 'credit' ? 'This account has no issued, unpaid invoice yet.' : 'This account has no open quotation yet.'}</p>}
          <DialogFooter><Button disabled={pending || !target} onClick={() => run(() => redeemRewardAction(rewardId, kind === 'credit' ? { invoiceId: target } : { quotationId: target }, note), 'Reward used', () => setOpen(false))}>{pending && <Loader2 className="animate-spin" />} Use reward</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

type Programme = { referred_discount_pct: number; referrer_credit_pct: number; free_fitting_every: number; reward_validity_days: number }
export function ProgrammeSettings({ value }: { value: Programme }) {
  const { pending, run } = useRun()
  const [v, setV] = useState(value)
  const field = (k: keyof Programme, label: string) => (
    <div className="space-y-1"><Label htmlFor={`rp-${k}`}>{label}</Label><Input id={`rp-${k}`} type="number" className="num" value={v[k]} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} /></div>
  )
  return (
    <div className="space-y-3 text-sm">
      {field('referred_discount_pct', 'Referred business: % off first order')}
      {field('referrer_credit_pct', 'Referrer: credit % when paid')}
      {field('free_fitting_every', 'Free fitting every N orders (0 = off)')}
      {field('reward_validity_days', 'Rewards valid for (days)')}
      <Button size="sm" variant="outline" disabled={pending || JSON.stringify(v) === JSON.stringify(value)} onClick={() => run(() => saveReferralProgrammeAction(v), 'Programme saved')}><Save aria-hidden /> Save</Button>
    </div>
  )
}
