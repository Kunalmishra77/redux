'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser } from '@/lib/auth/session'
import { renderTemplate } from '@/lib/services/templates'
import type { Result } from '@/lib/result'

// D4-08: free text only inside the 24-hour service window; outside it, an approved template.
// Demo (decision 28 Sep 2026): the message is recorded as sent and appears in the thread; in
// production it is queued for the worker, which sends it through the Cloud API.
export async function sendInboxMessageAction(input: { conversationId: string; text?: string; templateCode?: string }): Promise<Result<null>> {
  const user = await getSessionUser()
  if (!user) return { ok: false, code: 'AUTH', message: 'Sign in again.' }
  const supabase = await createClient()
  // RLS decides whether this person may see — and therefore reply in — this conversation
  const { data: convo } = await supabase.from('whatsapp_conversations')
    .select('id, window_expires_at, profile_name, lead:leads(name)').eq('id', input.conversationId).maybeSingle()
  if (!convo) return { ok: false, code: 'NOT_FOUND', message: 'This conversation is not yours.' }

  const open = convo.window_expires_at && new Date(convo.window_expires_at) > new Date()
  let body = input.text?.trim() ?? ''
  let kind = 'text'
  if (input.templateCode) {
    const { data: t } = await supabase.from('message_templates').select('code, body, variables, category').eq('code', input.templateCode).maybeSingle()
    if (!t) return { ok: false, code: 'TEMPLATE', message: 'That template is not approved.' }
    const name = ((convo.lead as unknown as { name: string | null } | null)?.name ?? convo.profile_name ?? '').split(' ')[0]
    body = renderTemplate(t.body, (t.variables as string[]) ?? [], { name })
    kind = 'template'
  } else {
    if (!open) return { ok: false, code: 'WINDOW_CLOSED', message: 'The 24-hour window has closed — send an approved template instead.' }
    if (!body) return { ok: false, code: 'EMPTY', message: 'Write a message first.' }
  }

  const { error } = await createAdminClient().from('whatsapp_messages').insert({
    conversation_id: convo.id, wamid: `wamid.DEMO-${crypto.randomUUID()}`, direction: 'outbound', kind,
    body, template_code: input.templateCode ?? null, status: 'sent', sent_by: user.id,
  })
  if (error) return { ok: false, code: 'SEND_FAILED', message: 'The message could not be sent.' }
  await createAdminClient().from('whatsapp_conversations').update({ last_message_at: new Date().toISOString() }).eq('id', convo.id)
  revalidatePath('/staff/inbox')
  return { ok: true, data: null }
}
