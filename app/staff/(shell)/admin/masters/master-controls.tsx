'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { addMasterAction, toggleMasterAction } from '@/lib/actions/admin'

type Toggleable = Parameters<typeof toggleMasterAction>[0]
type Addable = Parameters<typeof addMasterAction>[0]

export function MasterToggle({ table, id, active, label }: { table: Toggleable; id: string; active: boolean; label: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Switch checked={active} disabled={pending} aria-label={`${label} active`} onCheckedChange={(v) => start(async () => {
      const r = await toggleMasterAction(table, id, v)
      if (r.ok) { toast.success(v ? `${label} is back in the lists` : `${label} retired`); router.refresh() } else toast.error(r.message)
    })} />
  )
}

export function AddMaster({ table }: { table: Addable }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [pending, start] = useTransition()
  const add = () => start(async () => {
    const r = await addMasterAction(table, name)
    if (r.ok) { toast.success(`${name.trim()} added`); setName(''); router.refresh() } else toast.error(r.message)
  })
  return (
    <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); add() }}>
      <Input className="h-9" placeholder="Add…" value={name} onChange={(e) => setName(e.target.value)} aria-label="New entry" />
      <Button type="submit" size="sm" variant="outline" disabled={pending || name.trim().length < 2}><Plus aria-hidden /> Add</Button>
    </form>
  )
}
