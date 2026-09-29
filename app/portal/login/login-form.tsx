'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { requestLoginOtpAction, verifyLoginOtpAction } from '@/lib/actions/portal-auth'

export function LoginForm({ next, demo }: { next?: string; demo: boolean }) {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [demoCode, setDemoCode] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const send = () => start(async () => {
    const r = await requestLoginOtpAction(phone)
    if (!r.ok) { toast.error(r.message); return }
    setDemoCode(r.data.demoCode ?? null)
    setStep('code')
  })
  const verify = () => start(async () => {
    const r = await verifyLoginOtpAction(phone, code, next)
    if (r && !r.ok) toast.error(r.message)
  })

  if (step === 'phone') return (
    <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); send() }}>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Mobile number</Label>
        <div className="flex">
          <span className="flex items-center rounded-l-md border border-r-0 border-line bg-surface px-3 text-sm text-muted-ink">+91</span>
          <Input id="phone" inputMode="numeric" autoComplete="tel-national" maxLength={11} value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, ''))} className="num h-12 rounded-l-none text-base" placeholder="98100 11001" autoFocus />
        </div>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending || phone.replace(/\D/g, '').length !== 10}>
        {pending ? <Loader2 className="animate-spin" /> : <MessageCircle aria-hidden />} Send code on WhatsApp
      </Button>
    </form>
  )

  return (
    <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); verify() }}>
      <button type="button" onClick={() => { setStep('phone'); setCode('') }} className="inline-flex items-center gap-1 text-sm text-redux-blue hover:underline"><ArrowLeft className="size-4" aria-hidden /> +91 {phone}</button>
      {demo && demoCode && <p className="rounded-md bg-redux-lime/30 px-3 py-2 text-sm text-ink">Demo code: <strong className="num tracking-[0.3em]">{demoCode}</strong></p>}
      <div className="space-y-1.5">
        <Label htmlFor="code">6-digit code</Label>
        <Input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="num h-12 text-center text-xl tracking-[0.5em]" autoFocus />
        <p className="text-xs text-muted-ink">Valid for 10 minutes.</p>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending || code.length !== 6}>{pending && <Loader2 className="animate-spin" />} Sign in</Button>
      <button type="button" disabled={pending} onClick={send} className="w-full text-center text-sm text-muted-ink hover:text-ink">Send a new code</button>
    </form>
  )
}
