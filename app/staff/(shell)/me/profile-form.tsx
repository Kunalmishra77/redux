'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateMyProfileAction } from '@/lib/actions/users'

export function ProfileForm({ fullName, phone, email }: { fullName: string; phone: string; email: string }) {
  const router = useRouter()
  const [name, setName] = useState(fullName)
  const [mobile, setMobile] = useState(phone)
  const [pending, start] = useTransition()
  const dirty = name !== fullName || mobile !== phone
  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault()
      start(async () => {
        const r = await updateMyProfileAction({ full_name: name, phone: mobile })
        if (r.ok) { toast.success('Saved'); router.refresh() } else toast.error(r.message)
      })
    }}>
      <div className="space-y-1.5"><Label htmlFor="p-name">Full name</Label><Input id="p-name" className="h-10" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="space-y-1.5"><Label htmlFor="p-phone">Mobile</Label><Input id="p-phone" className="num h-10" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+91 98100 00000" /></div>
      <div className="space-y-1.5"><Label htmlFor="p-email">Work email</Label><Input id="p-email" className="h-10" value={email} disabled /><p className="text-xs text-muted-ink">Your sign-in email — the Super Admin can change it.</p></div>
      <Button type="submit" disabled={!dirty || pending || name.trim().length < 2}>{pending && <Loader2 className="animate-spin" />} Save changes</Button>
    </form>
  )
}
