import Link from 'next/link'
import { FlaskConical } from 'lucide-react'

// Visible on every screen in demo mode: nothing leaves the system — every WhatsApp, OTP and payment
// is simulated and listed in the demo outbox (decision 28 Sep 2026).
export function DemoBar() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') return null
  return (
    <div className="flex items-center justify-center gap-2 bg-ink px-4 py-1.5 text-xs text-pale">
      <FlaskConical className="size-3.5 text-redux-lime" aria-hidden />
      <span>Demo — sample data. WhatsApp, OTP and payments are simulated.</span>
      <Link href="/demo/outbox" className="font-semibold text-redux-lime underline-offset-2 hover:underline">Open the demo outbox →</Link>
    </div>
  )
}
