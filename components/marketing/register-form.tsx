'use client'

import * as React from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, MessageCircle } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { completeRegistrationAction, startRegistrationAction } from '@/lib/actions/register'
import type { RegistrationInput } from '@/lib/validators/registration'

// CR-001 phase 2 — "Create business account": step 1 details + consent, step 2 the mobile code.
type Opt = { id?: string; code?: string; name: string }

const control = 'h-11 w-full rounded-md border border-line bg-white px-3 text-[15px] text-ink outline-none placeholder:text-faint focus-visible:border-redux-blue focus-visible:ring-3 focus-visible:ring-redux-blue/20 aria-invalid:border-danger'

export function RegisterForm({ segments, cities, noticeVersion }: { segments: Opt[]; cities: Opt[]; noticeVersion: string | null }) {
  const [step, setStep] = React.useState<'details' | 'code'>('details')
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [input, setInput] = React.useState<RegistrationInput | null>(null)
  const [demoCode, setDemoCode] = React.useState<string | null>(null)
  const [code, setCode] = React.useState('')
  const [pending, start] = React.useTransition()
  // BR-R1: a referral link (/r/{code}) arrives as ?ref= and a cookie — fill in "referred by" with it
  const referredRef = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('ref')
    const fromCookie = document.cookie.split('; ').find((c) => c.startsWith('redux_ref='))?.split('=')[1]
    const code = fromUrl ?? fromCookie
    if (code && referredRef.current && !referredRef.current.value) referredRef.current.value = code
  }, [])

  const submitDetails = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const v = (k: string) => String(f.get(k) ?? '')
    const data: RegistrationInput = {
      businessName: v('businessName'), legalName: v('legalName'), segment: v('segment'), sizeUnits: v('sizeUnits'),
      cityId: v('cityId'), pincode: v('pincode'), contactName: v('contactName'), roleTitle: v('roleTitle'), phone: v('phone'),
      email: v('email'), gstin: v('gstin'), referredBy: v('referredBy'),
      consentService: (f.get('consentService') === 'on') as true, consentMarketing: f.get('consentMarketing') === 'on',
      noticeVersion: noticeVersion ?? '',
    }
    start(async () => {
      const r = await startRegistrationAction(data, v('website'))
      if (!r.ok) { setErrors(r.fields ?? {}); toast.error(r.message); return }
      setErrors({}); setInput(data); setDemoCode(r.data.demoCode ?? null); setStep('code')
    })
  }
  const submitCode = (e: React.FormEvent) => {
    e.preventDefault()
    start(async () => {
      const r = await completeRegistrationAction(input!, code)
      if (r && !r.ok) toast.error(r.message)
    })
  }

  if (step === 'code') return (
    <form onSubmit={submitCode} className="mt-8 space-y-5">
      <button type="button" onClick={() => setStep('details')} className="inline-flex items-center gap-1 text-sm font-medium text-redux-blue hover:underline"><ArrowLeft className="size-4" aria-hidden /> Edit details</button>
      <p className="text-[15px] text-ink">We sent a 6-digit code on WhatsApp to <strong className="num">{input?.phone}</strong>.</p>
      {demoCode && <p className="rounded-md bg-redux-lime/30 px-3 py-2 text-sm">Demo code: <strong className="num tracking-[0.3em]">{demoCode}</strong></p>}
      <div className="max-w-xs space-y-1.5">
        <label htmlFor="reg-code" className="text-sm font-medium text-ink">Code</label>
        <input id="reg-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          className={cn(control, 'num h-12 text-center text-xl tracking-[0.5em]')} autoFocus />
      </div>
      <Button type="submit" size="lg" disabled={pending || code.length !== 6}>{pending && <Loader2 className="animate-spin" />} Create my account</Button>
    </form>
  )

  return (
    <form onSubmit={submitDetails} noValidate className="mt-8 grid gap-5 sm:grid-cols-2">
      <p className="eyebrow text-muted-ink sm:col-span-2">Your business</p>
      <Field name="businessName" error={errors.businessName} label="Business or property name" className="sm:col-span-2"><input id="reg-businessName" name="businessName" className={control} aria-invalid={!!errors.businessName} placeholder="e.g. Hotel Saffron Court" /></Field>
      <Field name="segment" error={errors.segment} label="Type of business">
        <select id="reg-segment" name="segment" defaultValue="" className={cn(control, 'pr-3')} aria-invalid={!!errors.segment}>
          <option value="" disabled>Choose…</option>{segments.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
        </select></Field>
      <Field name="sizeUnits" error={errors.sizeUnits} label="Rooms / bathrooms" optional><input id="reg-sizeUnits" name="sizeUnits" inputMode="numeric" className={cn(control, 'num')} /></Field>
      <Field name="cityId" error={errors.cityId} label="City">
        <select id="reg-cityId" name="cityId" defaultValue="" className={cn(control, 'pr-3')}>
          <option value="">Other city</option>{cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select></Field>
      <Field name="pincode" error={errors.pincode} label="Pincode" optional><input id="reg-pincode" name="pincode" inputMode="numeric" maxLength={6} className={cn(control, 'num')} aria-invalid={!!errors.pincode} /></Field>
      <Field name="legalName" error={errors.legalName} label="Registered company name" optional><input id="reg-legalName" name="legalName" className={control} /></Field>
      <Field name="gstin" error={errors.gstin} label="GSTIN" optional><input id="reg-gstin" name="gstin" className={cn(control, 'num uppercase')} aria-invalid={!!errors.gstin} /></Field>

      <p className="eyebrow mt-2 text-muted-ink sm:col-span-2">You</p>
      <Field name="contactName" error={errors.contactName} label="Your name"><input id="reg-contactName" name="contactName" autoComplete="name" className={control} aria-invalid={!!errors.contactName} /></Field>
      <Field name="roleTitle" error={errors.roleTitle} label="Your role" optional><input id="reg-roleTitle" name="roleTitle" className={control} placeholder="e.g. Chief Engineer" /></Field>
      <Field name="phone" error={errors.phone} label="Mobile number">
        <div className="flex"><span className="flex items-center rounded-l-md border border-r-0 border-line bg-surface px-3 text-sm text-muted-ink">+91</span>
          <input id="reg-phone" name="phone" inputMode="numeric" autoComplete="tel-national" className={cn(control, 'num rounded-l-none')} aria-invalid={!!errors.phone} /></div></Field>
      <Field name="email" error={errors.email} label="Work email" optional><input id="reg-email" name="email" type="email" autoComplete="email" className={control} aria-invalid={!!errors.email} /></Field>
      <Field name="referredBy" error={errors.referredBy} label="Referred by another business?" optional className="sm:col-span-2"><input ref={referredRef} id="reg-referredBy" name="referredBy" className={control} placeholder="Business name or referral code" /></Field>

      <div className="hidden" aria-hidden><label htmlFor="reg-website">Website</label><input id="reg-website" name="website" tabIndex={-1} autoComplete="off" /></div>
      <div className="space-y-3 sm:col-span-2">
        <label className="flex items-start gap-3 text-sm text-ink"><input type="checkbox" name="consentService" className="mt-0.5 size-4 accent-redux-blue" />
          <span>REDUX may contact me about this account and my enquiries. <Link href="/privacy" className="text-redux-blue underline-offset-2 hover:underline">Privacy notice</Link>{noticeVersion ? ` v${noticeVersion}` : ''}</span></label>
        {errors.consentService && <p className="text-sm text-danger">{errors.consentService}</p>}
        <label className="flex items-start gap-3 text-sm text-ink"><input type="checkbox" name="consentMarketing" className="mt-0.5 size-4 accent-redux-blue" />
          <span>Send me occasional offers and updates <span className="text-faint">(optional)</span></span></label>
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" size="lg" disabled={pending || !noticeVersion} className="w-full sm:w-auto">{pending ? <Loader2 className="animate-spin" /> : <MessageCircle aria-hidden />} Continue — verify my mobile</Button>
        <p className="mt-3 text-sm text-muted-ink">Already have an account? <Link href="/portal/login" className="font-medium text-redux-blue hover:underline">Sign in</Link></p>
      </div>
    </form>
  )
}

function Field({ name, label, optional, error, children, className }: { name: string; label: string; optional?: boolean; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={`reg-${name}`} className="block text-sm font-medium text-ink">{label}{optional && <span className="ml-1 font-normal text-faint">(optional)</span>}</label>
      {children}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  )
}
