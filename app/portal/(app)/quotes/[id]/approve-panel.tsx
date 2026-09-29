'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { requestApprovalOtpAction, verifyApprovalOtpAction } from '@/lib/actions/portal'

// BR-Q4: this sentence is shown above the code box and recorded with the approval (terms_text).
const ACCEPTANCE = 'By entering the code, I approve this quotation and accept the terms shown on it.'

export function ApprovePanel({ quoteId, defaultName, phone }: { quoteId: string; defaultName: string; phone: string | null }) {
  const router = useRouter()
  const [name, setName] = useState(defaultName)
  const [otp, setOtp] = useState<{ id: string; demoCode?: string } | null>(null)
  const [code, setCode] = useState('')
  const [wait, setWait] = useState(0)
  const [pending, start] = useTransition()

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  const request = () => start(async () => {
    const r = await requestApprovalOtpAction(quoteId)
    if (!r.ok) { toast.error(r.message); return }
    setOtp({ id: r.data.otpId, demoCode: r.data.demoCode })
    setCode('')
    setWait(30)
  })
  const verify = () => start(async () => {
    const r = await verifyApprovalOtpAction(quoteId, otp!.id, code, name)
    if (!r.ok) { toast.error(r.message); return }
    toast.success('Approved — thank you! Your job is booked.')
    router.refresh()
  })

  return (
    <section className="rounded-xl border-2 border-redux-blue bg-white p-5 shadow-card">
      <h2 className="text-lg font-semibold text-ink">Approve this quotation</h2>
      {!otp ? (
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5 sm:max-w-sm">
            <Label htmlFor="ap-name">Your name</Label>
            <Input id="ap-name" value={name} onChange={(e) => setName(e.target.value)} className="h-11" placeholder="As it should appear on the approval" />
          </div>
          <Button size="lg" disabled={pending || name.trim().length < 2} onClick={request}>
            {pending ? <Loader2 className="animate-spin" /> : <ShieldCheck aria-hidden />} Approve — send me a code
          </Button>
          <p className="text-xs text-muted-ink">We’ll send a 6-digit code on WhatsApp to {phone ?? 'your number'}.</p>
        </div>
      ) : (
        <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); verify() }}>
          <p className="rounded-md bg-surface px-3 py-2.5 text-sm font-medium text-ink">{ACCEPTANCE}</p>
          {otp.demoCode && <p className="rounded-md bg-redux-lime/30 px-3 py-2 text-sm">Demo code: <strong className="num tracking-[0.3em]">{otp.demoCode}</strong></p>}
          <div className="space-y-1.5 sm:max-w-xs">
            <Label htmlFor="ap-code">Code sent to {phone}</Label>
            <Input id="ap-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="num h-12 text-center text-xl tracking-[0.5em]" autoFocus />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" disabled={pending || code.length !== 6}>{pending && <Loader2 className="animate-spin" />} Approve quotation</Button>
            <button type="button" onClick={request} disabled={wait > 0 || pending} className="text-sm text-muted-ink hover:text-ink disabled:opacity-60">{wait > 0 ? `Resend in ${wait}s` : 'Resend code'}</button>
          </div>
          <p className="text-xs text-muted-ink">Valid for 10 minutes · 5 tries.</p>
        </form>
      )}
    </section>
  )
}
