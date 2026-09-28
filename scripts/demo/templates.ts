// Loads the WhatsApp templates from blueprint/05-content/02-whatsapp-templates.md into
// message_templates, word for word, so the platform shows the approved copy (and the demo outbox
// renders exactly what the customer would receive). In the demo they are marked approved; for real,
// each is submitted to Meta first (E5-S05) and approved_at is set when Meta approves it.
import { readFileSync } from 'node:fs'
import type pg from 'pg'

export type ParsedTemplate = { code: string; category: 'utility' | 'authentication' | 'marketing'; body: string; variables: string[] }

// Templates whose copy carries no variable legend: names read from the copy itself (placeholder order).
const NAMED: Record<string, string[]> = {
  survey_reminder: ['name', 'date', 'slot', 'surveyor'],
  surveyor_on_way: ['name', 'surveyor', 'eta'],
  quote_shared: ['name', 'quote_no', 'fittings', 'total', 'valid_until'],
  quote_approved: ['name', 'quote_no', 'job_no'],
  quote_expiring: ['name', 'quote_no', 'valid_until'],
  dates_confirmed: ['name', 'job_no', 'batch', 'from', 'to'],
  job_update: ['name', 'job_no', 'unit', 'stage'],
  handover_complete: ['name', 'unit', 'fittings', 'warranty'],
  invoice_raised: ['name', 'invoice_no', 'job_no', 'amount', 'due'],
  payment_received: ['name', 'amount', 'invoice_no'],
  payment_overdue: ['name', 'invoice_no', 'amount', 'due'],
  service_ack: ['name', 'request_no', 'subject'],
  feedback_request: ['name', 'property'],
  warranty_expiring: ['name', 'kind', 'property', 'valid_until'],
  survey_booked: ['name', 'date', 'slot', 'surveyor'],
  enquiry_received: ['name', 'reference'],
}

const snake = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

export function parseTemplates(markdown: string): ParsedTemplate[] {
  const out: ParsedTemplate[] = []
  const blocks = markdown.split(/\n### /).slice(1)
  for (const block of blocks) {
    const head = /^`([a-z_]+)`\s*·\s*(Utility|Authentication|Marketing)/.exec(block)
    const body = /```\n([\s\S]*?)\n```/.exec(block)
    if (!head || !body) continue
    const legend = /`\{\{1\}\}`[^\n]*/.exec(block)?.[0] ?? ''
    const variables: string[] = []
    for (const m of legend.matchAll(/`\{\{(\d+)\}\}`\s*([^·`\n]+)/g)) variables[Number(m[1]) - 1] = snake(m[2]!)
    // OTP templates carry no legend: {{1}} is the code, {{2}} the quotation
    if (variables.length === 0) {
      const n = (body[1]!.match(/\{\{\d+\}\}/g) ?? []).length
      if (head[1]!.endsWith('otp')) variables.push('code', ...(n > 1 ? ['quote_no'] : []))
    }
    if (NAMED[head[1]!]) variables.splice(0, variables.length, ...NAMED[head[1]!]!)
    out.push({ code: head[1]!, category: head[2]!.toLowerCase() as ParsedTemplate['category'], body: body[1]!.trim(), variables })
  }
  return out
}

export async function seedTemplates(db: pg.Client) {
  const templates = parseTemplates(readFileSync('blueprint/05-content/02-whatsapp-templates.md', 'utf8'))
  for (const t of templates) {
    await db.query(
      `insert into public.message_templates (code, channel, category, provider_template_name, language, body, variables, approved_at)
       values ($1, 'whatsapp', $2::public.msg_category, $1, 'en', $3, $4::jsonb, now())
       on conflict (code) do update set body = excluded.body, variables = excluded.variables, category = excluded.category`,
      [t.code, t.category, t.body, JSON.stringify(t.variables)])
  }
  return templates.length
}
