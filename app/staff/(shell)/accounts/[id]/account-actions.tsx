'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Pencil, Plus, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { addAccountActivityAction, createGroupAction, setAccountVerifiedAction, updateAccountProfileAction, updateAccountRequirementsAction } from '@/lib/actions/accounts'

type Opt = { id: string; name: string }
type Profile = { legal_name: string; segment_id: string | null; group_id: string | null; account_owner_id: string | null; size_units: number | null }

const select = 'h-10 w-full rounded-md border border-line bg-white px-2 text-sm'

export function AccountActions({ id, verified, profile, segments, groups, staff }: {
  id: string; verified: boolean; profile: Profile; segments: Opt[]; groups: Opt[]; staff: { id: string; full_name: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [p, setP] = useState(profile)
  const [newGroup, setNewGroup] = useState('')
  const [pending, start] = useTransition()
  const verify = () => start(async () => {
    const r = await setAccountVerifiedAction(id, !verified)
    if (r.ok) { toast.success(verified ? 'Verification removed' : 'Account verified — full history and reports are open to its contacts'); router.refresh() } else toast.error(r.message)
  })
  const save = () => start(async () => {
    let groupId = p.group_id
    if (newGroup.trim()) {
      const g = await createGroupAction(newGroup)
      if (!g.ok) { toast.error(g.message); return }
      groupId = g.data.id
    }
    const r = await updateAccountProfileAction(id, { ...p, group_id: groupId })
    if (r.ok) { toast.success('Account updated'); setOpen(false); setNewGroup(''); router.refresh() } else toast.error(r.message)
  })
  return (
    <>
      <Button size="sm" variant={verified ? 'outline' : 'default'} disabled={pending} onClick={verify}><ShieldCheck aria-hidden /> {verified ? 'Unverify' : 'Verify account'}</Button>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Pencil aria-hidden /> Edit</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Account profile</DialogTitle><DialogDescription>Segment, group and owner drive reports, assignment and (from phase 4) scoring.</DialogDescription></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="a-legal">Legal name</Label><Input id="a-legal" value={p.legal_name} onChange={(e) => setP({ ...p, legal_name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="a-seg">Segment</Label>
              <select id="a-seg" className={select} value={p.segment_id ?? ''} onChange={(e) => setP({ ...p, segment_id: e.target.value || null })}>
                <option value="">—</option>{segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select></div>
            <div className="space-y-1.5"><Label htmlFor="a-size">Rooms / bathrooms</Label>
              <Input id="a-size" type="number" min={0} className="num" value={p.size_units ?? ''} onChange={(e) => setP({ ...p, size_units: e.target.value === '' ? null : Number(e.target.value) })} /></div>
            <div className="space-y-1.5"><Label htmlFor="a-owner">Account owner</Label>
              <select id="a-owner" className={select} value={p.account_owner_id ?? ''} onChange={(e) => setP({ ...p, account_owner_id: e.target.value || null })}>
                <option value="">Not assigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select></div>
            <div className="space-y-1.5"><Label htmlFor="a-group">Group / chain</Label>
              <select id="a-group" className={select} value={p.group_id ?? ''} onChange={(e) => setP({ ...p, group_id: e.target.value || null })} disabled={!!newGroup.trim()}>
                <option value="">None</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <Input placeholder="…or a new group name" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} aria-label="New group name" />
            </div>
          </div>
          <DialogFooter><Button disabled={pending} onClick={save}>{pending && <Loader2 className="animate-spin" />} Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

const KINDS = [['meeting', 'Meeting'], ['visit', 'Site visit'], ['call_note', 'Call note'], ['email', 'Email'], ['other', 'Other']] as const

export function ActivityButton({ customerId }: { customerId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>('meeting')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [pending, start] = useTransition()
  const save = () => start(async () => {
    const r = await addAccountActivityAction(customerId, kind, title, body)
    if (r.ok) { toast.success('Added to the timeline'); setOpen(false); setTitle(''); setBody(''); router.refresh() } else toast.error(r.message)
  })
  return (
    <>
      <Button size="xs" variant="outline" onClick={() => setOpen(true)}><Plus aria-hidden /> Log activity</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Log an activity</DialogTitle><DialogDescription>Internal — the customer never sees it. It can’t be edited later.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map(([k, label]) => <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k} className={`rounded-full px-3 py-1 text-sm ring-1 ${kind === k ? 'bg-redux-blue text-white ring-redux-blue' : 'text-ink ring-line hover:bg-surface'}`}>{label}</button>)}
            </div>
            <div className="space-y-1.5"><Label htmlFor="act-title">What happened</Label><Input id="act-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Met the GM and the chief engineer" /></div>
            <div className="space-y-1.5"><Label htmlFor="act-body">Details (optional)</Label><Textarea id="act-body" rows={3} value={body} onChange={(e) => setBody(e.target.value)} /></div>
          </div>
          <DialogFooter><Button disabled={pending || title.trim().length < 2} onClick={save}>{pending && <Loader2 className="animate-spin" />} Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

type Reqs = { current_requirements: string; future_requirements: string; next_action: string; next_action_at: string; website: string }

// D26 — requirements now / later and the next step, editable by whoever works the account
export function RequirementsButton({ customerId, value }: { customerId: string; value: Reqs }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [r, setR] = useState(value)
  const [pending, start] = useTransition()
  const save = () => start(async () => {
    const res = await updateAccountRequirementsAction(customerId, r)
    if (res.ok) { toast.success('Saved'); setOpen(false); router.refresh() } else toast.error(res.message)
  })
  return (
    <>
      <Button size="xs" variant="outline" onClick={() => { setR(value); setOpen(true) }}><Pencil aria-hidden /> Edit</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Requirements & next step</DialogTitle><DialogDescription>Internal — what this business needs, and what we do next.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="r-now">Needs now</Label><Textarea id="r-now" rows={3} value={r.current_requirements} onChange={(e) => setR({ ...r, current_requirements: e.target.value })} placeholder="e.g. 48 rooms, chrome dulling on mixers, wants it before the wedding season" /></div>
            <div className="space-y-1.5"><Label htmlFor="r-later">Later / pipeline</Label><Textarea id="r-later" rows={2} value={r.future_requirements} onChange={(e) => setR({ ...r, future_requirements: e.target.value })} placeholder="e.g. Second property in Gurugram, refurb planned for 2027" /></div>
            <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
              <div className="space-y-1.5"><Label htmlFor="r-next">Next action</Label><Input id="r-next" value={r.next_action} onChange={(e) => setR({ ...r, next_action: e.target.value })} placeholder="e.g. Send the pilot proposal" /></div>
              <div className="space-y-1.5"><Label htmlFor="r-when">By</Label><Input id="r-when" type="date" value={r.next_action_at} onChange={(e) => setR({ ...r, next_action_at: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="r-web">Website</Label><Input id="r-web" value={r.website} onChange={(e) => setR({ ...r, website: e.target.value })} placeholder="hotel.com" /></div>
          </div>
          <DialogFooter><Button disabled={pending} onClick={save}>{pending && <Loader2 className="animate-spin" />} Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
