'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { addStaffAction, setStaffActiveAction, setStaffCityAction } from '@/lib/actions/users'

type City = { id: string; name: string }

export function StaffActive({ userId, active, name, disabled }: { userId: string; active: boolean; name: string; disabled?: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return <Switch checked={active} disabled={disabled || pending} aria-label={`${name} active`} onCheckedChange={(v) => start(async () => {
    const r = await setStaffActiveAction(userId, v)
    if (r.ok) { toast.success(v ? `${name} can sign in again` : `${name} deactivated — their records stay`); router.refresh() } else toast.error(r.message)
  })} />
}

export function StaffCity({ userId, cityId, cities }: { userId: string; cityId: string | null; cities: City[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Select value={cityId ?? 'none'} disabled={pending} onValueChange={(v) => start(async () => {
      const r = await setStaffCityAction(userId, v === 'none' ? null : v)
      if (r.ok) { toast.success('City updated'); router.refresh() } else toast.error(r.message)
    })}>
      <SelectTrigger className="h-8 w-40" aria-label="City"><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="none">All cities</SelectItem>{cities.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
    </Select>
  )
}

export function AddStaffButton({ cities }: { cities: City[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ full_name: '', email: '', phone: '+91', role: 'cc_exec' as 'cc_exec' | 'surveyor' | 'super_admin', city_id: '' })
  const [pending, start] = useTransition()
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }))
  const submit = () => start(async () => {
    const r = await addStaffAction({ ...f, city_id: f.city_id || undefined })
    if (r.ok) { toast.success(`${f.full_name} added — invitation email queued`); setOpen(false); setF({ full_name: '', email: '', phone: '+91', role: 'cc_exec', city_id: '' }); router.refresh() } else toast.error(r.message)
  })
  return (
    <>
      <Button onClick={() => setOpen(true)}><UserPlus aria-hidden /> Add a person</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add a person</DialogTitle><DialogDescription>They get an email to set their password. Their role decides what they can see.</DialogDescription></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="u-name">Full name</Label><Input id="u-name" value={f.full_name} onChange={set('full_name')} /></div>
            <div className="space-y-1.5"><Label htmlFor="u-email">Work email</Label><Input id="u-email" type="email" value={f.email} onChange={set('email')} /></div>
            <div className="space-y-1.5"><Label htmlFor="u-phone">Mobile</Label><Input id="u-phone" inputMode="tel" value={f.phone} onChange={set('phone')} /></div>
            <div className="space-y-1.5"><Label htmlFor="u-role">Role</Label>
              <Select value={f.role} onValueChange={(v) => setF((s) => ({ ...s, role: v as typeof f.role }))}>
                <SelectTrigger id="u-role" className="h-10 w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="cc_exec">Care Executive</SelectItem><SelectItem value="surveyor">Surveyor</SelectItem><SelectItem value="super_admin">Super Admin</SelectItem></SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label htmlFor="u-city">City</Label>
              <Select value={f.city_id || 'none'} onValueChange={(v) => setF((s) => ({ ...s, city_id: v === 'none' ? '' : v }))}>
                <SelectTrigger id="u-city" className="h-10 w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">All cities</SelectItem>{cities.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select></div>
          </div>
          <DialogFooter><Button disabled={pending || !f.full_name || !f.email} onClick={submit}>{pending && <Loader2 className="animate-spin" />} Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
