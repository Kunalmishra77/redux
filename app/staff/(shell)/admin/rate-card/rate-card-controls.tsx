'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, CopyPlus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { activateRateCardAction, newRateCardVersionAction, setRatePriceAction } from '@/lib/actions/admin'
import { formatInr } from '@/lib/services/money'

export function NewVersionButton({ fromId }: { fromId: string }) {
  const [pending, start] = useTransition()
  return (
    <Button disabled={pending} onClick={() => start(async () => {
      const r = await newRateCardVersionAction(fromId)
      if (r && !r.ok) toast.error(r.message)
    })}>{pending ? <Loader2 className="animate-spin" /> : <CopyPlus aria-hidden />} New version from this</Button>
  )
}

export function ActivateButton({ id, version }: { id: string; version: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button size="sm" disabled={pending} onClick={() => start(async () => {
      const r = await activateRateCardAction(id)
      if (r.ok) { toast.success(`v${version} is active — new quotes use it`); router.refresh() } else toast.error(r.message)
    })}>{pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 aria-hidden />} Activate v{version}</Button>
  )
}

// A price: plain text when frozen; an inline input on a draft, saved on blur.
export function PriceCell({ id, price, kind, frozen }: { id: string; price: number; kind: 'rate' | 'market'; frozen: boolean }) {
  const router = useRouter()
  const [value, setValue] = useState(String(price))
  const [pending, start] = useTransition()
  if (frozen) return <span className="num">{formatInr(String(price), 'never')}</span>
  const save = () => {
    const n = Number(value)
    if (n === price) return
    start(async () => {
      const r = await setRatePriceAction(id, n, kind)
      if (r.ok) { toast.success('Price saved to the draft'); router.refresh() } else { toast.error(r.message); setValue(String(price)) }
    })
  }
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-muted-ink">₹</span>
      <input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} onBlur={save}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        aria-label="Price" disabled={pending}
        className="num h-8 w-24 rounded-md border border-line bg-white px-2 text-right text-sm outline-none focus:border-redux-blue focus:ring-2 focus:ring-redux-blue/20" />
    </span>
  )
}
