'use client'

import { useActionState, useRef } from 'react'
import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signIn, type SignInState } from './actions'

const DEMO_ACCOUNTS = [
  { email: 'vikram@redux.demo', name: 'Vikram Sethi', role: 'Super Admin', blurb: 'Dashboard, pipeline, jobs, money, stock' },
  { email: 'priya@redux.demo', name: 'Priya Nair', role: 'Care Executive', blurb: 'My leads, calls, survey booking, inbox' },
  { email: 'ankit@redux.demo', name: 'Ankit Verma', role: 'Surveyor', blurb: 'My surveys and quotes (web)' },
]

export function LoginForm({ next, demo, demoPassword }: { next?: string; demo: boolean; demoPassword?: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {})
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  function signInAsDemo(email: string) {
    if (!emailRef.current || !passwordRef.current || !demoPassword) return
    emailRef.current.value = email
    passwordRef.current.value = demoPassword
    formRef.current?.requestSubmit()
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-[28px] font-semibold text-ink">Sign in</h1>
      <p className="mt-1 text-sm text-muted-ink">The REDUX team workspace — leads, surveys, quotes and jobs.</p>

      {state.error && (
        <div role="alert" className="mt-5 flex gap-2 rounded-md border border-danger/30 bg-danger-bg px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.error}
        </div>
      )}

      <form ref={formRef} action={action} className="mt-6 space-y-4" noValidate>
        <input type="hidden" name="next" value={next ?? ''} />
        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input ref={emailRef} id="email" name="email" type="email" autoComplete="username" className="h-11"
            aria-invalid={!!state.fieldErrors?.email} aria-describedby={state.fieldErrors?.email ? 'email-error' : undefined} />
          {state.fieldErrors?.email && <p id="email-error" className="text-xs text-danger">{state.fieldErrors.email}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input ref={passwordRef} id="password" name="password" type="password" autoComplete="current-password" className="h-11"
            aria-invalid={!!state.fieldErrors?.password} aria-describedby={state.fieldErrors?.password ? 'password-error' : undefined} />
          {state.fieldErrors?.password && <p id="password-error" className="text-xs text-danger">{state.fieldErrors.password}</p>}
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      {demo && (
        <div className="mt-8">
          <p className="eyebrow text-muted-ink">Demo — sign in as</p>
          <ul className="mt-3 space-y-2">
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.email}>
                <button type="button" onClick={() => signInAsDemo(a.email)} disabled={pending}
                  className="group flex w-full items-center justify-between gap-3 rounded-md border border-line bg-white px-3.5 py-3 text-left transition-colors hover:border-redux-blue hover:bg-surface">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{a.name} <span className="font-normal text-muted-ink">· {a.role}</span></span>
                    <span className="block truncate text-xs text-muted-ink">{a.blurb}</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-redux-blue transition-transform group-hover:translate-x-0.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
