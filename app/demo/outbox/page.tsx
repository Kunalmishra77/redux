import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CheckCheck, Clock, Inbox, MessageCircle } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { EmptyState, formatWhen, StatusPill } from '@/components/patterns'
import { createAdminClient } from '@/lib/supabase/admin'
import { renderTemplate } from '@/lib/services/templates'
import { nowMs } from '@/lib/services/clock'

export const metadata: Metadata = { title: 'Demo outbox' }

const PORTAL_LINK: Record<string, (id: string) => string> = {
  quotations: (id) => `/portal/quotes/${id}`,
  invoices: (id) => `/portal/invoices/${id}`,
  jobs: (id) => `/portal/jobs/${id}`,
  job_units: () => '/portal',
  warranties: () => '/portal/warranty',
  service_requests: () => '/portal/service-requests',
}

type Msg = {
  id: string; rule_code: string | null; template_code: string | null; channel: string; category: string | null; to_address: string
  variables: Record<string, unknown>; status: string; send_after: string; queued_at: string; entity_type: string | null; entity_id: string | null
  lead: { name: string | null } | null; customer: { name: string } | null
}

// Demo only (decision 28 Sep 2026): nothing leaves the system. Every WhatsApp the platform would send
// is listed here, rendered from the approved template copy, exactly as the customer would see it.
export default async function DemoOutboxPage() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') notFound()
  const admin = createAdminClient()
  const [{ data: msgs }, { data: templates }] = await Promise.all([
    admin.from('messages')
      .select('id, rule_code, template_code, channel, category, to_address, variables, status, send_after, queued_at, entity_type, entity_id, lead:leads(name), customer:customers(name)')
      .order('queued_at', { ascending: false }).limit(120),
    admin.from('message_templates').select('code, body, variables'),
  ])
  const tpl = new Map((templates ?? []).map((t) => [t.code, t]))
  const list = (msgs ?? []) as unknown as Msg[]
  const now = nowMs()

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <Logo />
            <span className="rounded-sm bg-ink px-2 py-1 text-[11px] font-semibold text-redux-lime">DEMO OUTBOX</span>
          </div>
          <Link href="/staff" className="inline-flex items-center gap-1 text-sm font-medium text-redux-blue hover:underline"><ArrowLeft className="size-4" aria-hidden /> Back to the app</Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-[28px] font-semibold text-ink">What customers would receive</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-ink">
          Every WhatsApp the platform queues — enquiry acknowledgements, survey confirmations, OTPs, quote approvals — rendered from the
          approved template copy. In the demo nothing is sent; in production the queue worker delivers these through Meta’s Cloud API.
        </p>

        {list.length === 0 ? (
          <div className="mt-8"><EmptyState icon={Inbox} title="Nothing queued yet" body="Book a survey or create a lead — its WhatsApp appears here." /></div>
        ) : (
          <ul className="mt-8 grid gap-4 md:grid-cols-2">
            {list.map((m) => {
              const t = m.template_code ? tpl.get(m.template_code) : undefined
              const name = m.lead?.name ?? m.customer?.name ?? 'there'
              const values = { name: name.split(' ')[0], reference: m.entity_id?.slice(0, 8).toUpperCase(), ...m.variables }
              const text = t ? renderTemplate(t.body, (t.variables as string[]) ?? [], values) : '(template not loaded)'
              const held = new Date(m.send_after).getTime() > now
              return (
                <li key={m.id} className="overflow-hidden rounded-lg border border-line bg-white shadow-card">
                  <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-whatsapp/15 text-[#128C7E]"><MessageCircle className="size-4" aria-hidden /></span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">{name}</span>
                        <span className="num block text-xs text-muted-ink">{m.to_address}</span>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {m.rule_code && <span className="num rounded-sm bg-surface px-1.5 py-0.5 text-[11px] font-semibold text-muted-ink">{m.rule_code}</span>}
                      <StatusPill tone={m.category === 'marketing' ? 'waiting' : 'neutral'}>{m.category ?? m.channel}</StatusPill>
                    </span>
                  </div>
                  <div className="bg-[#ECE5DD] px-4 py-4">
                    <div className="relative max-w-[92%] rounded-lg rounded-tl-none bg-white px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-line text-ink shadow-sm">
                      {text}
                      <span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-faint">
                        {formatWhen(m.queued_at)} <CheckCheck className="size-3.5 text-[#53BDEB]" aria-hidden />
                      </span>
                    </div>
                    {/* the button a real WhatsApp template carries — here it opens the same portal page */}
                    {m.entity_id && PORTAL_LINK[m.entity_type ?? ''] && m.category !== 'authentication' && (
                      <Link href={PORTAL_LINK[m.entity_type!]!(m.entity_id)} className="mt-1.5 block max-w-[92%] rounded-lg bg-white py-2 text-center text-[13px] font-semibold text-[#128C7E] shadow-sm hover:bg-[#f7f7f7]">
                        {m.entity_type === 'quotations' ? 'View & approve quotation' : m.entity_type === 'invoices' ? 'View & pay invoice' : 'Open my REDUX portal'}
                      </Link>
                    )}
                  </div>
                  <p className="flex items-center gap-1.5 px-4 py-2 text-xs text-muted-ink">
                    {held ? <><Clock className="size-3.5 text-warning" aria-hidden /> Held for quiet hours — goes at {formatWhen(m.send_after)}</>
                          : <>Template <span className="font-mono">{m.template_code}</span> · {m.status === 'queued' ? 'simulated as sent' : m.status}</>}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
