'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, UserMinus, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { inviteColleagueAction, removeColleagueAction } from '@/lib/actions/portal'

const ROLES = [['engineering', 'Engineering'], ['accounts', 'Accounts'], ['purchase', 'Purchase'], ['operations', 'Operations'], ['other', 'Other']] as const

export function InviteColleague({ customerId }: { customerId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('engineering')
  const [pending, start] = useTransition()
  const invite = () => start(async () => {
    const r = await inviteColleagueAction(customerId, name, phone, role)
    if (r.ok) { toast.success(`${name.trim()} added — they get a WhatsApp invite`); setOpen(false); setName(''); setPhone(''); router.refresh() } else toast.error(r.message)
  })
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><UserPlus aria-hidden /> Add colleague</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add a colleague</DialogTitle><DialogDescription>They sign in with their own mobile number and see this account’s work, proposals and invoices.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="c-name">Name</Label><Input id="c-name" className="h-11" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="c-phone">Mobile number</Label>
              <div className="flex"><span className="flex items-center rounded-l-md border border-r-0 border-line bg-surface px-3 text-sm text-muted-ink">+91</span>
                <Input id="c-phone" className="num h-11 rounded-l-none" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, ''))} /></div></div>
            <div className="space-y-1.5"><Label htmlFor="c-role">Role</Label>
              <select id="c-role" value={role} onChange={(e) => setRole(e.target.value)} className="h-11 w-full rounded-md border border-line bg-white px-2 text-sm">
                {ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></div>
          </div>
          <DialogFooter><Button disabled={pending || name.trim().length < 2 || phone.replace(/\D/g, '').length !== 10} onClick={invite}>{pending && <Loader2 className="animate-spin" />} Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function RemoveColleague({ contactId, name }: { contactId: string; name: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button size="xs" variant="ghost" disabled={pending} aria-label={`Remove ${name}`} onClick={() => start(async () => {
      if (!window.confirm(`Remove ${name} from this account?`)) return
      const r = await removeColleagueAction(contactId)
      if (r.ok) { toast.success(`${name} removed`); router.refresh() } else toast.error(r.message)
    })}>{pending ? <Loader2 className="animate-spin" /> : <UserMinus aria-hidden />} Remove</Button>
  )
}
