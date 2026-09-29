import { db, kvGet, kvSet } from './db'
import { emitChange } from './events'
import { supabase } from './supabase'

// Download: the surveyor's visits (last 30 days + upcoming), their properties and units, the
// master lists and the ACTIVE rate card. RLS limits every query to what a surveyor may read;
// the client filters too (ADR-004 rule 4). Local, not-yet-synced state always wins over the server.

type Row = Record<string, unknown>
const str = (v: unknown) => (v === null || v === undefined ? null : String(v))

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null
  return v ?? null
}

export async function pullAll(): Promise<void> {
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id
  if (!userId) throw new Error('signed_out')

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const [surveysRes, typesRes, brandsRes, finishesRes, flagsRes, itemsRes, marketRes] = await Promise.all([
    supabase
      .from('surveys')
      .select(
        `id, status, scheduled_at, slot_end_at, submitted_at, surveyor_id,
         property:properties(id, name, address, lat, lng, unit_label,
           customer:customers(name, type),
           units:property_units(id, label, floor)),
         lead:leads(name, phone)`,
      )
      .eq('surveyor_id', userId)
      .neq('status', 'cancelled')
      .gte('scheduled_at', since)
      .order('scheduled_at'),
    supabase.from('fitting_types').select('id, code, name, sort_order').eq('is_active', true),
    supabase.from('brands').select('id, name').eq('is_active', true),
    supabase.from('finishes').select('id, code, name, hex').eq('is_active', true),
    supabase.from('condition_flags').select('id, code, name, sort_order').eq('is_active', true),
    supabase.from('rate_card_items').select('fitting_type_id, finish_id, price_text:price::text, work_type:work_types(code), rate_card:rate_cards!inner(is_active)').eq('rate_card.is_active', true),
    supabase.from('market_prices').select('fitting_type_id, finish_id, price_text:price::text, rate_card:rate_cards!inner(is_active)').eq('rate_card.is_active', true),
  ])
  for (const r of [surveysRes, typesRes, brandsRes, finishesRes, flagsRes, itemsRes, marketRes]) {
    if (r.error) throw r.error
  }
  const surveys = (surveysRes.data ?? []) as Row[]
  const surveyIds = surveys.map((s) => s.id as string)

  const fittingsRes = surveyIds.length
    ? await supabase
        .from('fittings')
        .select(
          `id, survey_id, property_unit_id, unit_label, fitting_type_id, brand_id, model, current_finish_id, captured_at,
           photos:fitting_photos(slot),
           conditions:fitting_conditions(condition_flag_id),
           assessment:assessments(recommended, finish_id, surveyor_note, part_unavailable_note,
             p_rec:price_recommended::text, p_rep:price_replace_eurobrass::text, p_mkt:price_market_replacement::text, save:you_save::text)`,
        )
        .in('survey_id', surveyIds)
    : { data: [], error: null }
  if (fittingsRes.error) throw fittingsRes.error
  const fittings = (fittingsRes.data ?? []) as Row[]

  const now = new Date().toISOString()
  await db.withExclusiveTransactionAsync(async (tx) => {
    // Masters and the rate card: replaced wholesale — they are the server's, never edited here
    await tx.execAsync('DELETE FROM fitting_types; DELETE FROM brands; DELETE FROM finishes; DELETE FROM condition_flags; DELETE FROM rate_card_items; DELETE FROM market_prices;')
    for (const t of (typesRes.data ?? []) as Row[]) {
      await tx.runAsync('INSERT INTO fitting_types (id, code, name, sort_order) VALUES (?, ?, ?, ?)', str(t.id), str(t.code), str(t.name), Number(t.sort_order ?? 0))
    }
    for (const b of (brandsRes.data ?? []) as Row[]) {
      await tx.runAsync('INSERT INTO brands (id, name) VALUES (?, ?)', str(b.id), str(b.name))
    }
    for (const f of (finishesRes.data ?? []) as Row[]) {
      await tx.runAsync('INSERT INTO finishes (id, code, name, hex) VALUES (?, ?, ?, ?)', str(f.id), str(f.code), str(f.name), str(f.hex))
    }
    for (const c of (flagsRes.data ?? []) as Row[]) {
      await tx.runAsync('INSERT INTO condition_flags (id, code, name, sort_order) VALUES (?, ?, ?, ?)', str(c.id), str(c.code), str(c.name), Number(c.sort_order ?? 0))
    }
    for (const i of (itemsRes.data ?? []) as Row[]) {
      const code = one(i.work_type as Row | Row[] | null)?.code
      if (!code) continue
      await tx.runAsync('INSERT INTO rate_card_items (fitting_type_id, work_type_code, finish_id, price) VALUES (?, ?, ?, ?)', str(i.fitting_type_id), String(code), str(i.finish_id), str(i.price_text))
    }
    for (const m of (marketRes.data ?? []) as Row[]) {
      await tx.runAsync('INSERT INTO market_prices (fitting_type_id, finish_id, price) VALUES (?, ?, ?)', str(m.fitting_type_id), str(m.finish_id), str(m.price_text))
    }

    for (const s of surveys) {
      const p = one(s.property as Row | Row[] | null)
      if (!p) continue
      const c = one(p.customer as Row | Row[] | null)
      const lead = one(s.lead as Row | Row[] | null)
      const status = String(s.status)
      await tx.runAsync(
        `INSERT INTO surveys (id, surveyor_id, status, scheduled_at, slot_end_at, property_id, property_name, address, lat, lng, unit_label,
           customer_name, customer_type, contact_name, contact_phone, submitted_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET status = excluded.status, scheduled_at = excluded.scheduled_at, slot_end_at = excluded.slot_end_at,
           property_id = excluded.property_id, property_name = excluded.property_name, address = excluded.address,
           lat = excluded.lat, lng = excluded.lng, unit_label = excluded.unit_label, customer_name = excluded.customer_name,
           customer_type = excluded.customer_type, contact_name = excluded.contact_name, contact_phone = excluded.contact_phone,
           submitted_at = excluded.submitted_at, synced_at = excluded.synced_at,
           submit_queued_at = CASE WHEN excluded.status = 'submitted' THEN NULL ELSE surveys.submit_queued_at END`,
        str(s.id), str(s.surveyor_id), status, str(s.scheduled_at), str(s.slot_end_at), str(p.id), str(p.name), str(p.address),
        p.lat === null || p.lat === undefined ? null : Number(p.lat), p.lng === null || p.lng === undefined ? null : Number(p.lng),
        p.unit_label === 'Bathroom' ? 'Bathroom' : 'Room', str(c?.name), str(c?.type), str(lead?.name), str(lead?.phone),
        str(s.submitted_at), now,
      )
      for (const u of (p.units as Row[] | null) ?? []) {
        await tx.runAsync(
          `INSERT INTO units (id, property_id, label, floor, is_local, created_at) VALUES (?, ?, ?, ?, 0, ?)
           ON CONFLICT(id) DO UPDATE SET label = excluded.label, floor = excluded.floor, is_local = 0`,
          str(u.id), str(p.id), str(u.label), str(u.floor), now,
        )
      }
    }

    for (const f of fittings) {
      const survey = surveys.find((s) => s.id === f.survey_id)
      const propertyId = str(one(survey?.property as Row | Row[] | null)?.id)
      if (!propertyId) continue
      let unitId = str(f.property_unit_id)
      const unitLabel = str(f.unit_label)
      if (!unitId && unitLabel) {
        // A unit recorded by label only: show it as a unit, keyed by label (is_local = 2, never uploaded)
        const real = await tx.getFirstAsync<{ id: string }>('SELECT id FROM units WHERE property_id = ? AND label = ? AND is_local <> 2', propertyId, unitLabel)
        unitId = real?.id ?? `label:${propertyId}:${unitLabel}`
        if (!real) {
          await tx.runAsync('INSERT OR IGNORE INTO units (id, property_id, label, is_local, created_at) VALUES (?, ?, ?, 2, ?)', unitId, propertyId, unitLabel, now)
        }
      }
      const slots = new Set(((f.photos as Row[] | null) ?? []).map((x) => x.slot)).size
      await tx.runAsync(
        `INSERT INTO fittings (id, survey_id, unit_id, unit_label, fitting_type_id, brand_id, model, finish_id, captured_at, from_server, server_slots)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
         ON CONFLICT(id) DO UPDATE SET server_slots = excluded.server_slots`,
        str(f.id), str(f.survey_id), unitId, unitLabel, str(f.fitting_type_id), str(f.brand_id), str(f.model), str(f.current_finish_id),
        str(f.captured_at), slots,
      )
      for (const c of (f.conditions as Row[] | null) ?? []) {
        await tx.runAsync('INSERT OR IGNORE INTO fitting_conditions (fitting_id, flag_id) VALUES (?, ?)', str(f.id), str(c.condition_flag_id))
      }
      const a = one(f.assessment as Row | Row[] | null)
      if (a) {
        // The server's prices are the truth once it has priced — unless a local change is still queued
        const queued = await tx.getFirstAsync<{ n: number }>(
          `SELECT count(*) AS n FROM outbox WHERE kind = 'assessment' AND status <> 'done' AND json_extract(payload, '$.fitting_id') = ?`, str(f.id),
        )
        if (!queued?.n) {
          await tx.runAsync(
            `INSERT INTO assessments (fitting_id, recommended, target_finish_id, surveyor_note, part_unavailable_note,
               price_recommended, price_replace_eurobrass, price_market_replacement, you_save, from_server)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
             ON CONFLICT(fitting_id) DO UPDATE SET recommended = excluded.recommended, target_finish_id = excluded.target_finish_id,
               surveyor_note = excluded.surveyor_note, part_unavailable_note = excluded.part_unavailable_note,
               price_recommended = excluded.price_recommended, price_replace_eurobrass = excluded.price_replace_eurobrass,
               price_market_replacement = excluded.price_market_replacement, you_save = excluded.you_save`,
            str(f.id), str(a.recommended), str(a.finish_id), str(a.surveyor_note), str(a.part_unavailable_note),
            str(a.p_rec), str(a.p_rep), str(a.p_mkt), str(a.save),
          )
        }
      }
    }
  })
  await kvSet('last_pull_at', now)
  emitChange()
}

export const lastPullAt = () => kvGet('last_pull_at')
