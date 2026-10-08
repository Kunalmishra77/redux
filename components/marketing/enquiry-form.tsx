'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertCircle, Building2, Home, Loader2, Store } from 'lucide-react'
import { cn } from 'cn'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { submitEnquiryAction, type EnquiryState } from '@/lib/actions/website'
import {
  CONTACT_TIMES,
  HOTEL_ROLES,
  OTHER_CITY,
  enquiryFromFormData,
  enquirySchema,
  fieldErrors,
  type EnquirerKind,
} from '@/lib/validators/enquiry'
import { readAttribution } from '@/components/marketing/attribution'
import { useB2C } from '@/components/marketing/enquiry-dialog'

export type EnquiryFormProps = {
  cities: { id: string; name: string }[]
  noticeVersion: string | null
  defaultKind?: EnquirerKind
  /** Hide the Home / Hotel / Dealer switch (the dealer page is dealer-only). */
  lockKind?: boolean
  className?: string
}

const KINDS: { value: EnquirerKind; label: string; icon: typeof Home }[] = [
  { value: 'home', label: 'Home', icon: Home },
  { value: 'hotel', label: 'Hotel', icon: Building2 },
  { value: 'dealer', label: 'Dealer', icon: Store },
]

const control =
  'h-11 w-full rounded-md border border-line bg-white px-3 text-[15px] text-ink shadow-none transition-colors outline-none placeholder:text-faint focus-visible:border-redux-blue focus-visible:ring-3 focus-visible:ring-redux-blue/20 aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger/15'

export function EnquiryForm({ cities, noticeVersion, defaultKind, lockKind = false, className }: EnquiryFormProps) {
  // BR-B3: the Home option exists only while B2C is on
  const b2c = useB2C()
  const kinds = KINDS.filter((k) => b2c || k.value !== 'home')
  const initialKind: EnquirerKind = defaultKind && (b2c || defaultKind !== 'home') ? defaultKind : 'hotel'
  const id = React.useId()
  const formRef = React.useRef<HTMLFormElement>(null)
  const [kind, setKind] = React.useState<EnquirerKind>(initialKind)
  const [city, setCity] = React.useState('')
  const [touched, setTouched] = React.useState<Set<string>>(() => new Set())
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  const validate = (form: HTMLFormElement, only?: Set<string>) => {
    const parsed = enquirySchema.safeParse(enquiryFromFormData(new FormData(form)))
    const all = parsed.success ? {} : fieldErrors(parsed.error)
    if (!only) return all
    return Object.fromEntries(Object.entries(all).filter(([k]) => only.has(k)))
  }

  // Inline validation on blur (design system §5): only fields the person has left are judged
  const onBlur = (e: React.FocusEvent<HTMLFormElement>) => {
    const name = (e.target as unknown as HTMLInputElement).name
    if (!name || !formRef.current || name === 'website') return
    const next = new Set(touched).add(name)
    setTouched(next)
    setErrors(validate(formRef.current, next))
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    setServerError(null)
    const found = validate(form)
    if (Object.keys(found).length) {
      setTouched(new Set(Object.keys(found)))
      setErrors(found)
      const first = form.querySelector<HTMLElement>(`[name="${Object.keys(found)[0]}"]`)
      first?.focus()
      return
    }
    const fd = new FormData(form)
    const honeypot = String(fd.get('website') ?? '')
    const input = enquiryFromFormData(fd)
    const attribution = readAttribution()
    startTransition(async () => {
      let res: EnquiryState = null
      try {
        res = await submitEnquiryAction(input, attribution, honeypot)
      } catch {
        res = { ok: false, code: 'NETWORK', message: 'We could not send your enquiry. Check your connection and try again.' }
      }
      if (res && !res.ok) {
        setServerError(res.message)
        if (res.fields) {
          setTouched(new Set(Object.keys(res.fields)))
          setErrors(res.fields)
        }
        return
      }
      toast.success('Enquiry received. We’ll call you within 2 working hours.')
    })
  }

  const err = (name: string) => errors[name]
  const describedBy = (name: string, hint?: boolean) =>
    [hint ? `${id}-${name}-hint` : null, err(name) ? `${id}-${name}-error` : null].filter(Boolean).join(' ') || undefined

  const onKindChange = (k: EnquirerKind) => {
    setKind(k)
    // the switch reveals different fields — drop verdicts on fields that are no longer shown
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([f]) => !['propertyName', 'firmName', 'units', 'gstin'].includes(f))))
  }

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={onSubmit}
      onBlur={onBlur}
      className={cn('relative space-y-5', className)}
      aria-describedby={serverError ? `${id}-server` : undefined}
    >
      {!serverError && (errors.noticeVersion || errors.kind) && (
        <div role="alert" className="flex items-start gap-2 rounded-md bg-danger-bg px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{errors.noticeVersion ?? errors.kind}</span>
        </div>
      )}
      {serverError && (
        <div id={`${id}-server`} role="alert" className="flex items-start gap-2 rounded-md bg-danger-bg px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{serverError}</span>
        </div>
      )}

      {lockKind ? (
        <input type="hidden" name="kind" value={kind} />
      ) : (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">I&apos;m a</legend>
          <div className={cn('grid gap-1 rounded-lg bg-surface p-1', kinds.length === 3 ? 'grid-cols-3' : 'grid-cols-2')} role="radiogroup" aria-label="I'm a">
            {kinds.map(({ value, label, icon: Icon }) => (
              <label
                key={value}
                className={cn(
                  'flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-redux-blue',
                  kind === value ? 'bg-redux-blue text-white shadow-card' : 'text-redux-blue hover:bg-select',
                )}
              >
                <input
                  type="radio"
                  name="kind"
                  value={value}
                  checked={kind === value}
                  onChange={() => onKindChange(value)}
                  className="sr-only"
                />
                <Icon className="size-4" aria-hidden />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id} name="name" label="Your name" error={err('name')}>
          <input
            id={`${id}-name`}
            name="name"
            autoComplete="name"
            className={control}
            aria-invalid={!!err('name')}
            aria-describedby={describedBy('name')}
            aria-required
          />
        </Field>

        <Field id={id} name="phone" label="Mobile number" error={err('phone')}>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[15px] text-muted-ink" aria-hidden>
              +91
            </span>
            <input
              id={`${id}-phone`}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="98100 00000"
              className={cn(control, 'num pl-12')}
              aria-invalid={!!err('phone')}
              aria-describedby={describedBy('phone')}
              aria-required
            />
          </div>
        </Field>

        <Field id={id} name="city" label="City" error={err('city')} className={city === OTHER_CITY ? '' : 'sm:col-span-2'}>
          <select
            id={`${id}-city`}
            name="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className={cn(control, 'appearance-none bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22none%22%20stroke%3D%22%230047ab%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m4%206%204%204%204-4%22/%3E%3C/svg%3E")] bg-[position:right_0.75rem_center] bg-no-repeat pr-9', !city && 'text-faint')}
            aria-invalid={!!err('city')}
            aria-describedby={describedBy('city')}
            aria-required
          >
            <option value="" disabled>
              Choose your city
            </option>
            {cities.map((c) => (
              <option key={c.id} value={c.id} className="text-ink">
                {c.name}
              </option>
            ))}
            <option value={OTHER_CITY} className="text-ink">
              Another city
            </option>
          </select>
        </Field>

        {city === OTHER_CITY && (
          <Field id={id} name="cityOther" label="Which city?" error={err('cityOther')}>
            <input
              id={`${id}-cityOther`}
              name="cityOther"
              autoComplete="address-level2"
              className={control}
              aria-invalid={!!err('cityOther')}
              aria-describedby={describedBy('cityOther')}
            />
          </Field>
        )}

        {kind === 'hotel' && (
          <>
            <Field id={id} name="propertyName" label="Property name" error={err('propertyName')}>
              <input
                id={`${id}-propertyName`}
                name="propertyName"
                autoComplete="organization"
                className={control}
                aria-invalid={!!err('propertyName')}
                aria-describedby={describedBy('propertyName')}
                aria-required
              />
            </Field>
            <Field id={id} name="units" label="Number of rooms" optional error={err('units')}>
              <input
                id={`${id}-units`}
                name="units"
                type="number"
                inputMode="numeric"
                min={1}
                max={5000}
                className={cn(control, 'num')}
                aria-invalid={!!err('units')}
                aria-describedby={describedBy('units')}
              />
            </Field>
            <Field id={id} name="role" label="Your role" optional error={err('role')}>
              <select id={`${id}-role`} name="role" defaultValue="" className={cn(control, 'pr-3')}>
                <option value="">Select</option>
                {HOTEL_ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
            <Field id={id} name="contactTime" label="Best time to call" optional error={err('contactTime')}>
              <select id={`${id}-contactTime`} name="contactTime" defaultValue="" className={cn(control, 'pr-3')}>
                <option value="">Any time</option>
                {CONTACT_TIMES.filter((t) => t !== 'Any time').map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
          </>
        )}

        {kind === 'dealer' && (
          <>
            <Field id={id} name="firmName" label="Firm name" error={err('firmName')}>
              <input
                id={`${id}-firmName`}
                name="firmName"
                autoComplete="organization"
                className={control}
                aria-invalid={!!err('firmName')}
                aria-describedby={describedBy('firmName')}
                aria-required
              />
            </Field>
            <Field id={id} name="gstin" label="GSTIN" optional error={err('gstin')}>
              <input
                id={`${id}-gstin`}
                name="gstin"
                autoCapitalize="characters"
                maxLength={15}
                className={cn(control, 'uppercase')}
                aria-invalid={!!err('gstin')}
                aria-describedby={describedBy('gstin')}
              />
            </Field>
          </>
        )}

        <Field
          id={id}
          name="message"
          label={kind === 'dealer' ? 'About your client’s fittings' : 'Recurring faults or fittings to look at'}
          optional
          error={err('message')}
          className="sm:col-span-2"
        >
          <textarea
            id={`${id}-message`}
            name="message"
            rows={3}
            maxLength={1000}
            placeholder={kind === 'hotel' ? 'e.g. shower mixers leaking on two floors; the model is discontinued' : 'e.g. a mixer that drips and a peeling chrome finish'}
            className={cn(control, 'h-auto min-h-24 py-2.5 leading-relaxed')}
            aria-invalid={!!err('message')}
            aria-describedby={describedBy('message')}
          />
        </Field>
      </div>

      {/* E2-S15 honeypot: invisible to people and screen readers; bots fill every field */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${id}-website`}>Website</label>
        <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      <input type="hidden" name="noticeVersion" value={noticeVersion ?? ''} />

      <div className="space-y-3 rounded-lg bg-surface p-4">
        <ConsentBox
          id={`${id}-consentService`}
          name="consentService"
          label="I agree to be contacted about my enquiry."
          error={err('consentService')}
          required
        />
        <ConsentBox
          id={`${id}-consentMarketing`}
          name="consentMarketing"
          label={
            <>
              Send me occasional updates about REDUX services. <span className="text-muted-ink">(optional)</span>
            </>
          }
        />
        <p className="text-[13px] text-muted-ink">
          We use your details only to respond to this enquiry. See our{' '}
          <Link href="/privacy" className="font-medium text-redux-blue underline underline-offset-2">
            Privacy Policy
          </Link>
          {noticeVersion ? <span className="text-faint"> · notice {noticeVersion}</span> : null}.
        </p>
      </div>

      <Button type="submit" size="lg" className="w-full text-base sm:h-13" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden /> Sending…
          </>
        ) : kind === 'dealer' ? (
          'Send dealer enquiry'
        ) : (
          'Book my free assessment'
        )}
      </Button>
      <p className="text-center text-[13px] text-muted-ink">
        The assessment is free and carries no obligation. We call back within 2 working hours.
      </p>
    </form>
  )
}

function Field({
  id,
  name,
  label,
  optional,
  error,
  className,
  children,
}: {
  id: string
  name: string
  label: React.ReactNode
  optional?: boolean
  error?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={`${id}-${name}`} className="block text-sm font-medium text-ink">
        {label}
        {optional && <span className="ml-1 font-normal text-faint">(optional)</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-${name}-error`} className="flex items-center gap-1.5 text-[13px] text-danger">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  )
}

function ConsentBox({
  id,
  name,
  label,
  error,
  required,
}: {
  id: string
  name: string
  label: React.ReactNode
  error?: string
  required?: boolean
}) {
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm text-ink">
        <input
          id={id}
          name={name}
          type="checkbox"
          // DPDP: never pre-ticked
          defaultChecked={false}
          className="mt-0.5 size-5 shrink-0 cursor-pointer rounded border-line accent-redux-blue"
          aria-invalid={!!error}
          aria-required={required}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <span>{label}</span>
      </label>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 ml-8 flex items-center gap-1.5 text-[13px] text-danger">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  )
}
