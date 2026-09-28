import 'server-only'

import type { LucideIcon } from 'lucide-react'
import { CalendarCheck, FileText, Flag, MessageCircle, Phone, PhoneMissed, Sparkles, StickyNote, Trophy, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { WorkLead, Option } from '@/components/features/leads/work-pane'
import type { TimelineItem } from '@/components/patterns'

// Server-side loaders for the lead screens. Every query runs as the signed-in user, so RLS decides
// what each person sees (ADR-004); the explicit filters are still here (rule 4).

export const LEAD_COLUMNS =
  'id, name, phone, status, property_name, unit_count, customer_type, enquirer_role, created_at, sla_due_at, city_id, ' +
  'assigned_to, source:lead_sources(code), city:cities(name), owner:profiles!leads_assigned_to_fkey(full_name)'

export type LeadRow = {
  id: string; name: string | null; phone: string; status: string; property_name: string | null; unit_count: number | null
  customer_type: string | null; enquirer_role: string | null; created_at: string; sla_due_at: string | null; city_id: string | null
  assigned_to: string | null; source: { code: string } | null; city: { name: string } | null; owner: { full_name: string } | null
}

export async function loadPickLists() {
  const supabase = await createClient()
  const [o, r, c] = await Promise.all([
    supabase.from('call_outcomes').select('code, name, requires_note').eq('is_active', true).order('sort_order'),
    supabase.from('lost_reasons').select('code, name, requires_note').eq('is_active', true).order('sort_order'),
    supabase.from('cities').select('id, name').eq('is_active', true).order('name'),
  ])
  const outcomes: Option[] = (o.data ?? []).map((x) => ({ code: x.code, name: x.name, requiresNote: x.requires_note }))
  const lostReasons: Option[] = (r.data ?? []).map((x) => ({ code: x.code, name: x.name, requiresNote: x.requires_note }))
  return { outcomes, lostReasons, cities: c.data ?? [] }
}

export function toWorkLead(l: LeadRow, hasOpenSurvey: boolean): WorkLead {
  return {
    id: l.id, name: l.name, phone: l.phone, status: l.status, propertyName: l.property_name, cityId: l.city_id,
    cityName: l.city?.name ?? null, unitCount: l.unit_count, customerType: l.customer_type, hasOpenSurvey,
  }
}

/** Everything that happened to a lead, newest first (D2-09). */
export async function loadLeadTimeline(leadId: string): Promise<TimelineItem[]> {
  const supabase = await createClient()
  const [hist, calls, notes, touches, surveys, quotes, convo] = await Promise.all([
    supabase.from('lead_status_history').select('id, from_status, to_status, note, changed_at, actor_id').eq('lead_id', leadId),
    supabase.from('calls').select('id, started_at, duration_sec, outcome_note, agent:profiles!calls_agent_id_fkey(full_name), outcome:call_outcomes(name, marks_contacted)').eq('lead_id', leadId),
    supabase.from('lead_notes').select('id, body, created_at, author:profiles!lead_notes_author_id_fkey(full_name)').eq('lead_id', leadId),
    supabase.from('lead_touches').select('id, occurred_at, source:lead_sources(code, name)').eq('lead_id', leadId),
    supabase.from('surveys').select('id, scheduled_at, status, submitted_at, surveyor:profiles!surveys_surveyor_id_fkey(full_name)').eq('lead_id', leadId),
    supabase.from('quotations').select('id, quote_no, version, status, total, issued_at, created_at').eq('lead_id', leadId),
    supabase.from('whatsapp_conversations').select('id, whatsapp_messages(id, direction, body, occurred_at, template_code)').eq('lead_id', leadId),
  ])
  const items: TimelineItem[] = []
  const LABEL: Record<string, string> = { new: 'New', contacted: 'Contacted', survey_booked: 'Survey booked', surveyed: 'Surveyed', quoted: 'Quoted', won: 'Won', lost: 'Lost' }
  const statusIcon = (s: string): LucideIcon => (s === 'won' ? Trophy : s === 'lost' ? Flag : s === 'new' ? Sparkles : CalendarCheck)

  for (const h of hist.data ?? []) {
    if (h.to_status === 'new' && !h.from_status) continue // the first touch already says it arrived
    items.push({ id: `h-${h.id}`, icon: statusIcon(h.to_status), at: h.changed_at,
      title: <>Moved to <strong>{LABEL[h.to_status]}</strong></>, body: h.note ?? undefined })
  }
  for (const t of touches.data ?? []) {
    const src = t.source as unknown as { name: string } | null
    items.push({ id: `t-${t.id}`, icon: UserPlus, at: t.occurred_at, title: <>Enquiry via <strong>{src?.name}</strong></> })
  }
  for (const c of calls.data ?? []) {
    const oc = c.outcome as unknown as { name: string; marks_contacted: boolean } | null
    const mins = c.duration_sec ? `${Math.floor(c.duration_sec / 60)}m ${c.duration_sec % 60}s` : null
    items.push({ id: `c-${c.id}`, icon: oc?.marks_contacted ? Phone : PhoneMissed, at: c.started_at,
      actor: (c.agent as unknown as { full_name: string } | null)?.full_name,
      title: <>Call — {oc?.name ?? 'logged'}{mins ? <span className="font-normal text-muted-ink"> · {mins}</span> : null}</>, body: c.outcome_note ?? undefined })
  }
  for (const n of notes.data ?? []) {
    items.push({ id: `n-${n.id}`, icon: StickyNote, at: n.created_at, actor: (n.author as unknown as { full_name: string } | null)?.full_name, title: 'Note', body: n.body })
  }
  for (const s of surveys.data ?? []) {
    items.push({ id: `s-${s.id}`, icon: CalendarCheck, at: s.submitted_at ?? s.scheduled_at,
      actor: (s.surveyor as unknown as { full_name: string } | null)?.full_name,
      title: s.status === 'submitted' ? 'Free survey completed' : s.status === 'cancelled' ? 'Survey cancelled' : `Free survey booked for ${new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(s.scheduled_at))}` })
  }
  for (const q of quotes.data ?? []) {
    items.push({ id: `q-${q.id}`, icon: FileText, at: q.issued_at ?? q.created_at,
      title: <>Quotation {q.quote_no} v{q.version} — {q.status.replace('_', ' ')}</> })
  }
  for (const c of convo.data ?? []) {
    for (const m of (c.whatsapp_messages as { id: string; direction: string; body: string | null; occurred_at: string; template_code: string | null }[]) ?? []) {
      items.push({ id: `w-${m.id}`, icon: MessageCircle, at: m.occurred_at,
        title: m.direction === 'inbound' ? 'WhatsApp from the customer' : 'WhatsApp sent', body: m.body ?? (m.template_code ? `Template: ${m.template_code}` : undefined) })
    }
  }
  return items.sort((a, b) => b.at.localeCompare(a.at))
}
