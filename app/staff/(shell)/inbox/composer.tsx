'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Clock, Lock, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { sendInboxMessageAction } from '@/lib/actions/inbox'
import { useNow } from '@/lib/hooks/use-now'

export function Composer({ conversationId, windowExpiresAt, templates }: {
  conversationId: string
  windowExpiresAt: string | null
  templates: { code: string; label: string }[]
}) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [template, setTemplate] = useState(templates[0]?.code ?? '')
  const now = useNow()
  const [pending, start] = useTransition()

  const left = windowExpiresAt && now !== null ? new Date(windowExpiresAt).getTime() - now : null
  const open = left !== null && left > 0
  const send = (payload: { text?: string; templateCode?: string }) => start(async () => {
    const r = await sendInboxMessageAction({ conversationId, ...payload })
    if (r.ok) { setText(''); toast.success('Sent'); router.refresh() } else toast.error(r.message)
  })

  return (
    <div className="border-t border-line bg-white p-4">
      {open ? (
        <>
          <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-ink">
            <Clock className="size-3.5 text-success" aria-hidden /> Service window open — free text allowed for another{' '}
            <span className="num font-semibold text-ink">{Math.floor(left / 3_600_000)}h {Math.floor((left % 3_600_000) / 60_000)}m</span>
          </p>
          <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); send({ text }) }}>
            <label htmlFor="reply" className="sr-only">Reply</label>
            <Textarea id="reply" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a reply…" className="min-h-0 flex-1 resize-none"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send({ text }) } }} />
            <Button type="submit" disabled={pending || !text.trim()} aria-label="Send"><Send aria-hidden /></Button>
          </form>
        </>
      ) : (
        <>
          <p className="mb-2 flex items-start gap-1.5 text-xs text-warning">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            The customer hasn’t messaged in 24 hours, so WhatsApp only allows an approved template. Free text opens again when they reply.
          </p>
          <div className="flex gap-2">
            <label htmlFor="tpl" className="sr-only">Template</label>
            <select id="tpl" value={template} onChange={(e) => setTemplate(e.target.value)} className="h-10 min-w-0 flex-1 rounded-md border border-line bg-white px-3 text-sm">
              {templates.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
            </select>
            <Button variant="secondary" disabled={pending || !template} onClick={() => send({ templateCode: template })}><Send aria-hidden /> Send template</Button>
          </div>
        </>
      )}
    </div>
  )
}
