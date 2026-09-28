// End-to-end smoke test of the queue worker against staging, without touching staging:
// everything runs inside ONE transaction that is rolled back at the end (ADR-013, no Docker).
//
//   pnpm worker:smoke
//
// webhook recorded → queued on pgmq → drained by the real processors → lead / chat exist with the
// right attribution → rolled back.
import pg from 'pg'
import { drainOnce, type WorkerDeps } from '../worker/index'

const deps: WorkerDeps = { graph: null, whatsapp: null, capi: null }   // no network in the smoke test

type Check = { name: string; ok: boolean; detail?: unknown }
const checks: Check[] = []
const check = (name: string, ok: boolean, detail?: unknown) => checks.push({ name, ok, detail })

async function main() {
  const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()
  await client.query('begin')
  try {
    const q = async <T extends pg.QueryResultRow>(sql: string, values?: unknown[]) => (await client.query<T>(sql, values)).rows

    // ── Google Ads lead, plus Google's "Send test data" ─────────────────────
    await q(`select public.record_webhook('google_ads', 'SMOKE-L1', 'lead', $1::jsonb, true)`, [JSON.stringify({
      lead_id: 'SMOKE-L1', gcl_id: 'gclid-smoke',
      user_column_data: [
        { column_id: 'FULL_NAME', string_value: 'Smoke Test' },
        { column_id: 'PHONE_NUMBER', string_value: '98999 00001' },
      ],
    })])
    await q(`select public.record_webhook('google_ads', 'SMOKE-TEST', 'lead', $1::jsonb, true)`, [JSON.stringify({
      lead_id: 'SMOKE-TEST', is_test: true, user_column_data: [{ column_id: 'PHONE_NUMBER', string_value: '9899900009' }],
    })])

    // ── WhatsApp: a click-to-WhatsApp first message ─────────────────────────
    await q(`select public.record_webhook('whatsapp', 'SMOKE-WA1', 'messages', $1::jsonb, true)`, [JSON.stringify({
      entry: [{ changes: [{ field: 'messages', value: {
        contacts: [{ wa_id: '918999900002', profile: { name: 'Smoke WA' } }],
        messages: [{ id: 'wamid.SMOKE1', from: '918999900002', timestamp: String(Math.floor(Date.now() / 1000)), type: 'text',
                     text: { body: 'My shower mixer is stiff' }, referral: { source_id: 'AD-SMOKE', source_type: 'ad', ctwa_clid: 'CLID-SMOKE' } }],
      } }] }],
    })])

    // ── A lead with no usable phone is dead-lettered, not retried forever ────
    await q(`select public.record_webhook('google_ads', 'SMOKE-NOPHONE', 'lead', $1::jsonb, true)`, [JSON.stringify({
      lead_id: 'SMOKE-NOPHONE', user_column_data: [{ column_id: 'FULL_NAME', string_value: 'No Phone' }],
    })])

    const handled = await drainOnce(client, deps, true)
    check('the worker drained the queue', handled >= 4, { handled })

    const [g] = await q<{ source: string; name: string; phone: string }>(
      `select s.code as source, l.name, l.phone from public.leads l join public.lead_sources s on s.id = l.source_id
       where l.google_lead_id = 'SMOKE-L1'`)
    check('Google Ads lead created, phone normalised to E.164 (BR-L1)', g?.phone === '+919899900001' && g?.source === 'google_ads', g)
    check('Google test data dropped', (await q(`select 1 from public.leads where google_lead_id = 'SMOKE-TEST'`)).length === 0)

    const [w] = await q<{ source: string; ctwa_clid: string; meta_ad_id: string }>(
      `select s.code as source, l.ctwa_clid, l.meta_ad_id from public.leads l join public.lead_sources s on s.id = l.source_id
       where l.phone = '+918999900002'`)
    check('WhatsApp CTWA lead created with ctwa_clid captured at creation (BR-L3)',
      w?.source === 'whatsapp_chat' && w?.ctwa_clid === 'CLID-SMOKE' && w?.meta_ad_id === 'AD-SMOKE', w)
    const [conv] = await q<{ lead_id: string; n: string }>(
      `select c.lead_id, (select count(*) from public.whatsapp_messages m where m.conversation_id = c.id)::text as n
       from public.whatsapp_conversations c where c.wa_id = '918999900002'`)
    check('the chat lands in the inbox, linked to the lead (D4-08)', !!conv?.lead_id && conv?.n === '1', conv)

    const cn1 = await q(`select 1 from public.messages m join public.leads l on l.id = m.lead_id
                         where m.rule_code = 'CN1' and l.google_lead_id = 'SMOKE-L1'`)
    check('CN1 acknowledgement queued for the Google lead', cn1.length === 1)

    const events = await q<{ external_id: string; status: string }>(
      `select external_id, status::text from public.webhook_events where external_id like 'SMOKE-%' order by external_id`)
    const byId = Object.fromEntries(events.map((e) => [e.external_id, e.status]))
    check('processed events are marked done', byId['SMOKE-L1'] === 'done' && byId['SMOKE-WA1'] === 'done', byId)
    check('an unusable lead is dead-lettered with an alert, not retried', byId['SMOKE-NOPHONE'] === 'dead', byId)

    // CN1 notifications stay queued (no WhatsApp configured) until their send time; the webhook
    // queue itself must be empty: every message was deleted in the same transaction as its work.
    const [left] = await q<{ n: string }>(
      `select count(*)::text as n from pgmq.q_q_webhooks where message ->> 'webhook_event_id' in
         (select id::text from public.webhook_events where external_id like 'SMOKE-%')`)
    check('no webhook message left behind', left?.n === '0', left)
  } finally {
    await client.query('rollback')
    await client.end()
  }

  for (const c of checks) console.log(`${c.ok ? '✓' : '✗'} ${c.name}${c.ok ? '' : `\n    ${JSON.stringify(c.detail)}`}`)
  console.log('rolled back — nothing was changed')
  process.exit(checks.every((c) => c.ok) ? 0 : 1)
}

main().catch((err) => { console.error(err); process.exit(1) })
