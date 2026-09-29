import type { Metadata } from 'next'
import { Logo } from '@/components/brand/logo'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Sign in' }

// D1s — phone + OTP. No passwords for customers.
export default async function PortalLogin({ searchParams }: PageProps<'/portal/login'>) {
  const { next } = await searchParams
  const demo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center"><Logo withTagline /></div>
          <div className="rounded-xl border border-line bg-white p-6 shadow-card">
            <h1 className="text-xl font-semibold text-ink">Your REDUX portal</h1>
            <p className="mt-1 text-sm text-muted-ink">Track your restoration, approve quotations, pay invoices and keep your warranty cards.</p>
            <LoginForm next={typeof next === 'string' ? next : undefined} demo={demo} />
          </div>
          {demo && (
            <div className="mt-5 rounded-lg border border-dashed border-line bg-white/60 p-4 text-xs text-muted-ink">
              <p className="font-semibold text-ink">Demo accounts</p>
              <p className="mt-1"><span className="num">98100 11001</span> — Anita Sharma, The Grand Orchid (hotel, job in progress)</p>
              <p className="num"><span>98100 11002</span> <span className="font-sans">— Rohit Mehra (home, job completed)</span></p>
              <p className="mt-1">The code is shown on screen and in the demo outbox.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
