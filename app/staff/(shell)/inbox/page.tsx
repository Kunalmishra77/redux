import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCheck, MessageCircle } from 'lucide-react'
import { cn } from 'cn'
import { EmptyState, formatRelative, formatWhen, PageHeader } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { Composer } from './composer'

export const metadata: Metadata = { title: 'Inbox' }

type Convo = {
  id: string; wa_id: string; profile_name: string | null; window_expires_at: string | null; last_message_at: string | null; ctwa_clid: string | null
  lead: { id: string; name: string | null; property_name: string | null } | null
  whatsapp_messages: { id: string; direction: string; body: string | null; occurred_at: string; status: string | null; kind: string; template_code: string | null }[]
}

// B11 — conversations (unread first) · thread · composer with the 24-hour window countdown.
export default async function InboxPage({ searchParams }: PageProps<'/staff/inbox'>) {
  await requireRole(['cc_exec', 'super_admin'])
  const sp = await searchParams
  const supabase = await createClient()
  const [{ data }, { data: templates }] = await Promise.all([
    supabase.from('whatsapp_conversations')
      .select('id, wa_id, profile_name, window_expires_at, last_message_at, ctwa_clid, lead:leads(id, name, property_name), whatsapp_messages(id, direction, body, occurred_at, status, kind, template_code)')
      .order('last_message_at', { ascending: false }),
    supabase.from('message_templates').select('code, category').eq('is_active', true).eq('category', 'utility').order('code'),
  ])
  const convos = ((data ?? []) as unknown as Convo[]).map((c) => {
    const msgs = [...c.whatsapp_messages].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
    const last = msgs[msgs.length - 1]
    return { ...c, msgs, last, unread: last?.direction === 'inbound' }
  }).sort((a, b) => Number(b.unread) - Number(a.unread) || (b.last_message_at ?? '').localeCompare(a.last_message_at ?? ''))
  const selected = convos.find((c) => c.id === sp.id) ?? convos[0]

  return (
    <>
      <PageHeader title="Inbox" description="WhatsApp conversations with your leads. Unread first." />
      {convos.length === 0 ? (
        <EmptyState icon={MessageCircle} title="No conversations yet" body="When a lead messages REDUX’s WhatsApp number, the chat appears here, linked to their lead." />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-lg border border-line bg-white shadow-card lg:h-[calc(100vh-15rem)] lg:min-h-[32rem] lg:grid-cols-[20rem_minmax(0,1fr)]">
          <ul className="max-h-64 overflow-y-auto border-b border-line lg:max-h-none lg:border-r lg:border-b-0" aria-label="Conversations">
            {convos.map((c) => (
              <li key={c.id}>
                <Link href={`?id=${c.id}`} aria-current={c.id === selected?.id ? 'true' : undefined}
                  className={cn('flex gap-3 border-b border-line px-4 py-3.5', c.id === selected?.id ? 'bg-select' : 'hover:bg-surface')}>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-whatsapp/15 text-sm font-semibold text-[#128C7E]">
                    {(c.lead?.name ?? c.profile_name ?? '?').slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn('truncate text-sm', c.unread ? 'font-bold text-ink' : 'font-medium text-ink')}>{c.lead?.name ?? c.profile_name ?? `+${c.wa_id}`}</span>
                      {c.last && <span className="shrink-0 text-[11px] text-faint">{formatRelative(c.last.occurred_at)}</span>}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className={cn('truncate text-xs', c.unread ? 'font-semibold text-ink' : 'text-muted-ink')}>{c.last?.body ?? 'Template message'}</span>
                      {c.unread && <span className="size-2 shrink-0 rounded-full bg-whatsapp" aria-label="unread" />}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {selected && (
            <section className="flex h-[70vh] min-h-0 flex-col lg:h-auto" aria-label="Conversation">
              <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{selected.lead?.name ?? selected.profile_name}</p>
                  <p className="num text-xs text-muted-ink">+{selected.wa_id}{selected.ctwa_clid ? ' · came from a Click-to-WhatsApp ad' : ''}</p>
                </div>
                {selected.lead && <Link href={`/staff/leads/${selected.lead.id}`} className="shrink-0 text-sm font-medium whitespace-nowrap text-redux-blue hover:underline">Open lead →</Link>}
              </header>
              <ol className="flex-1 space-y-3 overflow-y-auto bg-[#ECE5DD] px-5 py-5">
                {selected.msgs.map((m) => (
                  <li key={m.id} className={cn('flex', m.direction === 'outbound' ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-[75%] rounded-lg px-3.5 py-2 text-sm whitespace-pre-line shadow-sm',
                      m.direction === 'outbound' ? 'rounded-tr-none bg-[#D9FDD3] text-ink' : 'rounded-tl-none bg-white text-ink')}>
                      {m.kind === 'template' && <span className="eyebrow mb-1 block text-[#128C7E]">Template · {m.template_code}</span>}
                      {m.body}
                      <span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-faint">
                        {formatWhen(m.occurred_at)}
                        {m.direction === 'outbound' && <CheckCheck className={cn('size-3.5', m.status === 'read' ? 'text-[#53BDEB]' : 'text-faint')} aria-label={m.status ?? 'sent'} />}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
              <Composer conversationId={selected.id} windowExpiresAt={selected.window_expires_at}
                templates={(templates ?? []).map((t) => ({ code: t.code, label: t.code.replace(/_/g, ' ') }))} />
            </section>
          )}
        </div>
      )}
    </>
  )
}
