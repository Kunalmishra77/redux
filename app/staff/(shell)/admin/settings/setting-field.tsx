'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { setSettingAction } from '@/lib/actions/admin'

export function SettingField({ settingKey, label, unit, value, hint }: { settingKey: string; label: string; unit?: string; value: string; hint: string | null }) {
  const router = useRouter()
  const [v, setV] = useState(value)
  const [pending, start] = useTransition()
  const dirty = v !== value
  return (
    <div>
      <label htmlFor={settingKey} className="text-sm font-medium text-ink">{label}</label>
      <div className="mt-1.5 flex items-center gap-2">
        {unit === '₹' && <span className="text-sm text-muted-ink">₹</span>}
        <Input id={settingKey} type="number" min={0} value={v} onChange={(e) => setV(e.target.value)} className="num h-9 w-32" />
        {unit && unit !== '₹' && <span className="text-sm text-muted-ink">{unit}</span>}
        {dirty && <Button size="sm" disabled={pending || v === ''} onClick={() => start(async () => {
          const r = await setSettingAction(settingKey, Number(v))
          if (r.ok) { toast.success('Saved'); router.refresh() } else toast.error(r.message)
        })}>Save</Button>}
      </div>
      {hint && <p className="mt-1 text-xs text-faint">{hint.replace(/^(BR|D)[0-9]*-[A-Z0-9-]+:\s*/, '')}</p>}
    </div>
  )
}
