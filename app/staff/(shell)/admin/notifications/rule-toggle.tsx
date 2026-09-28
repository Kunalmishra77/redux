'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { toggleRuleAction } from '@/lib/actions/admin'

export function RuleToggle({ id, active, code }: { id: string; active: boolean; code: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return <Switch checked={active} disabled={pending} aria-label={`${code} on`} onCheckedChange={(v) => start(async () => {
    const r = await toggleRuleAction(id, v)
    if (r.ok) { toast.success(`${code} ${v ? 'on' : 'paused'}`); router.refresh() } else toast.error(r.message)
  })} />
}
