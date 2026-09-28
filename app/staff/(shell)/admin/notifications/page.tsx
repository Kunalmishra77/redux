import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, MessageCircle, Smartphone } from 'lucide-react'
import { PageHeader, StatusPill } from '@/components/patterns'
import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { RuleToggle } from './rule-toggle'

export const metadata: Metadata = { title: 'Notifications' }

const CATEGORY_TONE = { utility: 'positive', marketing: 'waiting', authentication: 'progress', service: 'neutral' } as const

// B35 — the rules that send messages and the templates they use. A utility template with a
// promotional line is reclassified by Meta as marketing (7.5× the price) — the category is shown on
// every template for that reason.
export default async function NotificationsPage({ searchParams }: PageProps<'/staff/admin/notifications'>) {
  await requireRole(['super_admin'])
  const { tab } = await searchParams
  const supabase = await createClient()
  const [{ data: rules }, { data: templates }, { data: sent }] = await Promise.all([
    supabase.from('notification_rules').select('id, code, trigger_event, template_code, channel, category, audience, is_active').order('code'),
    supabase.from('message_templates').select('id, code, channel, category, provider_template_name, language, body, variables, is_active, approved_at').order('code'),
    supabase.from('messages').select('template_code'),
  ])
  const count = (code: string) => (sent ?? []).filter((m) => m.template_code === code).length
  const showTemplates = tab === 'templates'
  return (
    <>
      <PageHeader eyebrow="Admin" title="Notifications" description="Which event sends which WhatsApp or SMS, to whom — and the exact words." />
      <nav className="mb-5 flex gap-1.5" aria-label="Tabs">
        {[['', `Rules (${rules?.length ?? 0})`], ['templates', `Templates (${templates?.length ?? 0})`]].map(([k, label]) => (
          <Link key={k} href={k ? `/staff/admin/notifications?tab=${k}` : '/staff/admin/notifications'}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${(tab ?? '') === k ? 'bg-redux-blue text-white' : 'bg-white text-muted-ink ring-1 ring-line hover:text-ink'}`}>{label}</Link>
        ))}
      </nav>
      {!showTemplates ? (
        <div className="overflow-hidden rounded-lg border border-line bg-white shadow-card">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line bg-surface text-left">
              {['Rule', 'When', 'Sends', 'To', 'Sent', 'On'].map((h) => <th key={h} className="eyebrow px-4 py-3 text-muted-ink">{h}</th>)}
            </tr></thead>
            <tbody>
              {(rules ?? []).map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="num px-4 py-3 font-semibold text-ink">{r.code}</td>
                  <td className="px-4 py-3 text-muted-ink">{r.trigger_event.replace(/[._]/g, ' ')}</td>
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5">{r.channel === 'whatsapp' ? <MessageCircle className="size-4 text-whatsapp" aria-hidden /> : <Smartphone className="size-4 text-muted-ink" aria-hidden />}<span className="num text-xs">{r.template_code}</span></span></td>
                  <td className="px-4 py-3 text-xs text-muted-ink">{r.audience}</td>
                  <td className="num px-4 py-3 text-muted-ink">{count(r.template_code)}</td>
                  <td className="px-4 py-3"><RuleToggle id={r.id} active={r.is_active} code={r.code} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(templates ?? []).map((t) => (
            <article key={t.id} className="rounded-lg border border-line bg-white p-4 shadow-card">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="num text-sm font-semibold text-ink">{t.code}</p>
                <div className="flex items-center gap-1.5">
                  <StatusPill tone={CATEGORY_TONE[t.category as keyof typeof CATEGORY_TONE] ?? 'neutral'}>{t.category}</StatusPill>
                  <span className="text-xs text-muted-ink">{t.channel} · {t.language}</span>
                </div>
              </div>
              <p className="rounded-md bg-[#E7F8EC] px-3 py-2.5 text-sm whitespace-pre-line text-ink">{t.body}</p>
              <p className="mt-2 flex items-center justify-between text-xs text-muted-ink">
                <span>{t.approved_at ? 'Approved by Meta' : <span className="inline-flex items-center gap-1 text-warning"><AlertTriangle className="size-3.5" aria-hidden /> Awaiting Meta approval</span>}</span>
                <span className="num">{count(t.code)} sent</span>
              </p>
            </article>
          ))}
        </div>
      )}
    </>
  )
}
