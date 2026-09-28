import type { Metadata } from 'next'
import { Camera, ClipboardCheck, PhoneCall, ShieldCheck } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { IconCircle } from '@/components/patterns'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Sign in' }

const HIGHLIGHTS = [
  { icon: PhoneCall, text: 'Every enquiry in one inbox — call, log and book the free survey in one screen' },
  { icon: Camera, text: 'Four photos per fitting, captured on site, synced when the signal returns' },
  { icon: ClipboardCheck, text: 'Restore, repair or replace — priced side by side from one rate card' },
  { icon: ShieldCheck, text: 'Approved by OTP, tracked room by room to a live warranty' },
]

export default async function StaffLoginPage({ searchParams }: PageProps<'/staff/login'>) {
  const { next } = await searchParams
  const demo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="relative hidden overflow-hidden bg-redux-blue p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Logo tone="white" withTagline />
        <div className="max-w-md">
          <p className="eyebrow text-redux-lime">REDUX workspace</p>
          <h2 className="mt-3 text-[34px] leading-tight font-semibold">
            From the first enquiry to a warrantied, back-in-service room.
          </h2>
          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map((h) => (
              <li key={h.text} className="flex items-start gap-3">
                <IconCircle icon={h.icon} tone="lime" size="sm" />
                <span className="pt-1 text-[15px] text-pale">{h.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-pale">D 8/7, Okhla Phase 1, New Delhi 110020</p>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Logo className="mb-10 lg:hidden" withTagline />
          <LoginForm next={typeof next === 'string' ? next : undefined} demo={demo} demoPassword={demo ? process.env.DEMO_PASSWORD : undefined} />
        </div>
      </section>
    </main>
  )
}
