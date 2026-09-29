import type { SQLiteDatabase } from 'expo-sqlite'
import { priceAssessment, type MarketPrice, type RateCardItem, type Treatment } from '@/lib/services/assessment-pricing'
import { db, kvGet } from './db'
import { emitChange } from './events'
import { deviceId, uuid } from './ids'
import { photoPath } from './supabase'

export const SLOTS = ['front', 'side', 'top', 'close_up'] as const
export type Slot = (typeof SLOTS)[number]
export const SLOT_LABEL: Record<Slot, string> = { front: 'Front', side: 'Side', top: 'Top', close_up: 'Close-up' }

export type LocalSurvey = {
  id: string
  status: string
  scheduled_at: string
  slot_end_at: string | null
  property_id: string
  property_name: string | null
  address: string | null
  lat: number | null
  lng: number | null
  unit_label: 'Room' | 'Bathroom'
  customer_name: string | null
  customer_type: string | null
  contact_name: string | null
  contact_phone: string | null
  checked_in_at: string | null
  checkin_accuracy_m: number | null
  submit_queued_at: string | null
  submitted_at: string | null
  synced_at: string | null
  fittings: number
  units: number
}

export type OutboxKind = 'checkin' | 'unit' | 'fitting' | 'conditions' | 'photo' | 'assessment' | 'submit'

/** Effective status: the server's, advanced by anything this device has queued but not yet sent. */
export function effectiveStatus(s: Pick<LocalSurvey, 'status' | 'checked_in_at' | 'submit_queued_at'>): string {
  if (s.status === 'submitted' || s.status === 'cancelled') return s.status
  if (s.submit_queued_at) return 'submitting'
  if (s.status === 'scheduled' && s.checked_in_at) return 'checked_in'
  return s.status
}

export const isOpen = (s: Pick<LocalSurvey, 'status' | 'checked_in_at' | 'submit_queued_at'>) =>
  ['scheduled', 'checked_in', 'in_progress'].includes(effectiveStatus(s))

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------
const SURVEY_SELECT = `
  SELECT s.*,
    (SELECT count(*) FROM fittings f WHERE f.survey_id = s.id) AS fittings,
    (SELECT count(DISTINCT coalesce(f.unit_id, f.unit_label)) FROM fittings f WHERE f.survey_id = s.id) AS units
  FROM surveys s`

export function listSurveys() {
  return db.getAllAsync<LocalSurvey>(`${SURVEY_SELECT} ORDER BY s.scheduled_at`)
}

export function getSurvey(id: string) {
  return db.getFirstAsync<LocalSurvey>(`${SURVEY_SELECT} WHERE s.id = ?`, id)
}

export type UnitRow = { id: string; label: string; floor: string | null; is_local: number; fittings: number; complete: number }

/** Units of the survey's property, with a per-unit fitting count and how many are fully photographed. */
export function listUnits(surveyId: string, propertyId: string) {
  return db.getAllAsync<UnitRow>(
    `SELECT u.id, u.label, u.floor, u.is_local,
       (SELECT count(*) FROM fittings f WHERE f.survey_id = ? AND f.unit_id = u.id) AS fittings,
       (SELECT count(*) FROM fittings f WHERE f.survey_id = ? AND f.unit_id = u.id
          AND (f.server_slots >= 4 OR (SELECT count(DISTINCT a.slot) FROM attachments a WHERE a.fitting_id = f.id) >= 4)) AS complete
     FROM units u WHERE u.property_id = ?
     ORDER BY u.is_local = 0 DESC, length(u.label), u.label`,
    surveyId, surveyId, propertyId,
  )
}

export function getUnit(id: string) {
  return db.getFirstAsync<{ id: string; label: string; property_id: string; is_local: number }>(
    'SELECT id, label, property_id, is_local FROM units WHERE id = ?', id,
  )
}

export type FittingRow = {
  id: string
  unit_id: string | null
  type_name: string
  brand_name: string | null
  finish_name: string | null
  model: string | null
  recommended: Treatment | null
  photos: number
  unsynced: number
  from_server: number
}

export function listFittings(surveyId: string, unitId?: string) {
  return db.getAllAsync<FittingRow>(
    `SELECT f.id, f.unit_id, t.name AS type_name, b.name AS brand_name, fi.name AS finish_name, f.model,
       a.recommended, f.from_server,
       max(f.server_slots, (SELECT count(DISTINCT slot) FROM attachments x WHERE x.fitting_id = f.id)) AS photos,
       (SELECT count(*) FROM attachments x WHERE x.fitting_id = f.id AND x.status <> 'synced') AS unsynced
     FROM fittings f
     LEFT JOIN fitting_types t ON t.id = f.fitting_type_id
     LEFT JOIN brands b ON b.id = f.brand_id
     LEFT JOIN finishes fi ON fi.id = f.finish_id
     LEFT JOIN assessments a ON a.fitting_id = f.id
     WHERE f.survey_id = ? ${unitId ? 'AND f.unit_id = ?' : ''}
     ORDER BY f.captured_at`,
    ...(unitId ? [surveyId, unitId] : [surveyId]),
  )
}

/** Fittings started on this device (photos taken) but never saved — shown so nothing is forgotten. */
export function listDrafts(surveyId: string) {
  return db.getAllAsync<{ fitting_id: string; photos: number; unit_id: string | null }>(
    `SELECT d.fitting_id, count(*) AS photos, (SELECT value FROM kv WHERE key = 'draft_unit:' || d.fitting_id) AS unit_id
     FROM draft_photos d WHERE d.survey_id = ? AND NOT EXISTS (SELECT 1 FROM fittings f WHERE f.id = d.fitting_id)
     GROUP BY d.fitting_id`,
    surveyId,
  )
}

export type Masters = {
  types: { id: string; name: string; code: string }[]
  brands: { id: string; name: string }[]
  finishes: { id: string; name: string; hex: string | null }[]
  flags: { id: string; name: string; code: string }[]
  items: RateCardItem[]
  market: MarketPrice[]
}

export async function getMasters(): Promise<Masters> {
  const [types, brands, finishes, flags, items, market] = await Promise.all([
    db.getAllAsync<Masters['types'][number]>('SELECT id, name, code FROM fitting_types ORDER BY sort_order, name'),
    db.getAllAsync<Masters['brands'][number]>('SELECT id, name FROM brands ORDER BY name'),
    db.getAllAsync<Masters['finishes'][number]>('SELECT id, name, hex FROM finishes ORDER BY name'),
    db.getAllAsync<Masters['flags'][number]>('SELECT id, name, code FROM condition_flags ORDER BY sort_order, name'),
    db.getAllAsync<{ fitting_type_id: string; work_type_code: string; finish_id: string | null; price: string }>('SELECT * FROM rate_card_items'),
    db.getAllAsync<{ fitting_type_id: string; finish_id: string | null; price: string }>('SELECT * FROM market_prices'),
  ])
  return {
    types, brands, finishes, flags,
    items: items.map((i) => ({ fittingTypeId: i.fitting_type_id, workTypeCode: i.work_type_code, finishId: i.finish_id, price: i.price })),
    market: market.map((m) => ({ fittingTypeId: m.fitting_type_id, finishId: m.finish_id, price: m.price })),
  }
}

/** Recently used values first — a surveyor auditing 40 basin mixers should not scroll 40 times. */
export async function recentIds(column: 'fitting_type_id' | 'brand_id' | 'finish_id'): Promise<string[]> {
  const rows = await db.getAllAsync<{ v: string }>(
    `SELECT ${column} AS v FROM fittings WHERE ${column} IS NOT NULL AND from_server = 0
     GROUP BY ${column} ORDER BY max(captured_at) DESC LIMIT 3`,
  )
  return rows.map((r) => r.v)
}

export type QuoteLine = {
  fitting_id: string
  unit_label: string | null
  type_name: string
  finish_name: string | null
  recommended: Treatment
  price_recommended: string | null
  price_replace_eurobrass: string | null
  price_market_replacement: string | null
  you_save: string | null
}

export function quoteLines(surveyId: string) {
  return db.getAllAsync<QuoteLine>(
    `SELECT f.id AS fitting_id, coalesce(u.label, f.unit_label) AS unit_label, t.name AS type_name, fi.name AS finish_name,
       a.recommended, a.price_recommended, a.price_replace_eurobrass, a.price_market_replacement, a.you_save
     FROM fittings f
     JOIN assessments a ON a.fitting_id = f.id
     LEFT JOIN units u ON u.id = f.unit_id
     LEFT JOIN fitting_types t ON t.id = f.fitting_type_id
     LEFT JOIN finishes fi ON fi.id = coalesce(a.target_finish_id, f.finish_id)
     WHERE f.survey_id = ? ORDER BY coalesce(u.label, f.unit_label), f.captured_at`,
    surveyId,
  )
}

export type SurveySync = { pending: number; failed: number; photosTotal: number; photosSynced: number }

export async function surveySync(surveyId: string): Promise<SurveySync> {
  const o = await db.getFirstAsync<{ pending: number; failed: number }>(
    `SELECT sum(status = 'pending') AS pending, sum(status = 'failed') AS failed FROM outbox WHERE survey_id = ? AND kind <> 'submit'`,
    surveyId,
  )
  const a = await db.getFirstAsync<{ total: number; synced: number }>(
    `SELECT count(*) AS total, sum(status = 'synced') AS synced FROM attachments WHERE survey_id = ?`, surveyId,
  )
  return { pending: o?.pending ?? 0, failed: o?.failed ?? 0, photosTotal: a?.total ?? 0, photosSynced: a?.synced ?? 0 }
}

// ---------------------------------------------------------------------------
// Writes — each is ONE SQLite transaction: local rows + their outbox rows, together.
// ---------------------------------------------------------------------------
async function enqueue(tx: SQLiteDatabase, surveyId: string, kind: OutboxKind, payload: object, label: string) {
  await tx.runAsync(
    `INSERT INTO outbox (id, survey_id, kind, payload, label, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    uuid(), surveyId, kind, JSON.stringify(payload), label, new Date().toISOString(),
  )
}

async function currentUserId(): Promise<string> {
  const id = await kvGet('user_id')
  if (!id) throw new Error('Not signed in')
  return id
}

/** BR-S3: GPS accuracy is recorded and flagged by the server — never blocks the check-in. */
export async function checkIn(survey: LocalSurvey, loc: { lat: number; lng: number; accuracy: number | null; mocked: boolean }) {
  const surveyorId = await currentUserId()
  const dev = await deviceId()
  const id = uuid()
  const at = new Date().toISOString()
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('UPDATE surveys SET checked_in_at = ?, checkin_accuracy_m = ? WHERE id = ?', at, loc.accuracy, survey.id)
    await enqueue(tx, survey.id, 'checkin', {
      id, survey_id: survey.id, surveyor_id: surveyorId, idem_key: `checkin:${id}`,
      lat: Number(loc.lat.toFixed(6)), lng: Number(loc.lng.toFixed(6)),
      accuracy_m: loc.accuracy === null ? null : Number(loc.accuracy.toFixed(2)),
      is_mocked: loc.mocked, device_id: dev, checked_in_at: at,
    }, `Check-in · ${survey.property_name ?? ''}`)
  })
  emitChange()
}

/** D7-03: a unit found on site. The label is unique per property (server constraint). */
export async function addUnit(survey: LocalSurvey, label: string, floor: string | null): Promise<string> {
  const clean = label.trim()
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM units WHERE property_id = ? AND lower(label) = lower(?)', survey.property_id, clean,
  )
  if (existing) return existing.id
  const id = uuid()
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      'INSERT INTO units (id, property_id, label, floor, is_local, created_at) VALUES (?, ?, ?, ?, 1, ?)',
      id, survey.property_id, clean, floor, new Date().toISOString(),
    )
    await enqueue(tx, survey.id, 'unit', { id, property_id: survey.property_id, label: clean, floor }, `${survey.unit_label} ${clean}`)
  })
  emitChange()
  return id
}

export type DraftPhoto = {
  slot: Slot
  local_uri: string
  sha256: string
  bytes: number
  width: number
  height: number
  lat: number | null
  lng: number | null
  accuracy_m: number | null
  captured_at: string
}

export async function saveDraftPhoto(surveyId: string, fittingId: string, unitId: string, p: DraftPhoto) {
  await db.withExclusiveTransactionAsync(async (tx) => {
    // A retake of an unsaved slot replaces the draft; the old file is kept until cleanup confirms nothing refers to it.
    await tx.runAsync(
      `INSERT INTO draft_photos (fitting_id, survey_id, slot, local_uri, sha256, bytes, width, height, lat, lng, accuracy_m, captured_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(fitting_id, slot) DO UPDATE SET local_uri = excluded.local_uri, sha256 = excluded.sha256, bytes = excluded.bytes,
         width = excluded.width, height = excluded.height, lat = excluded.lat, lng = excluded.lng,
         accuracy_m = excluded.accuracy_m, captured_at = excluded.captured_at`,
      fittingId, surveyId, p.slot, p.local_uri, p.sha256, p.bytes, p.width, p.height, p.lat, p.lng, p.accuracy_m, p.captured_at,
    )
    await tx.runAsync(
      `INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      `draft_unit:${fittingId}`, unitId,
    )
  })
  emitChange()
}

export function getDraftPhotos(fittingId: string) {
  return db.getAllAsync<DraftPhoto>('SELECT * FROM draft_photos WHERE fitting_id = ?', fittingId)
}

export type FittingInput = {
  id: string
  survey: LocalSurvey
  unit: { id: string; label: string; is_local: number }
  fittingTypeId: string
  typeName: string
  brandId: string | null
  model: string | null
  finishId: string | null
  conditionIds: string[]
  recommended: Treatment
  targetFinishId: string | null
  surveyorNote: string | null
  partUnavailableNote: string | null
  masters: Masters
}

/**
 * BR-S5: a fitting is saved only with all four photo slots. The fitting, its conditions, its
 * assessment, its four attachment rows and every outbox row go in ONE transaction — the
 * "no photo lost" guarantee (D7-09).
 */
export async function saveFitting(input: FittingInput) {
  const drafts = await getDraftPhotos(input.id)
  const missing = SLOTS.filter((s) => !drafts.some((d) => d.slot === s))
  if (missing.length) throw new Error(`Add the ${missing.map((m) => SLOT_LABEL[m].toLowerCase()).join(', ')} photo to save.`)

  // BR-A2: price offline from the synced rate card (the server re-prices on sync)
  const prices = priceAssessment({
    items: input.masters.items, market: input.masters.market, fittingTypeId: input.fittingTypeId,
    recommended: input.recommended, currentFinishId: input.finishId, targetFinishId: input.targetFinishId,
  })
  if (prices.missing.length) {
    throw new Error(`The rate card has no price for ${prices.missing.join(', ')}. Ask the office to add it, then refresh.`)
  }

  const dev = await deviceId()
  const now = new Date().toISOString()
  const virtualUnit = input.unit.is_local === 2 // a unit known only by its label (no property_units row)
  const label = `${input.survey.unit_label} ${input.unit.label} · ${input.typeName}`

  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `INSERT INTO fittings (id, survey_id, unit_id, unit_label, fitting_type_id, brand_id, model, finish_id, notes, captured_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.id, input.survey.id, input.unit.id, input.unit.label, input.fittingTypeId, input.brandId, input.model,
      input.finishId, null, now,
    )
    for (const c of input.conditionIds) {
      await tx.runAsync('INSERT OR IGNORE INTO fitting_conditions (fitting_id, flag_id) VALUES (?, ?)', input.id, c)
    }
    await tx.runAsync(
      `INSERT INTO assessments (fitting_id, recommended, target_finish_id, surveyor_note, part_unavailable_note,
         price_recommended, price_replace_eurobrass, price_market_replacement, you_save)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.id, input.recommended, input.targetFinishId, input.surveyorNote, input.partUnavailableNote,
      prices.recommended, prices.replaceEurobrass, prices.marketReplacement, prices.youSave,
    )

    await enqueue(tx, input.survey.id, 'fitting', {
      id: input.id, survey_id: input.survey.id,
      property_unit_id: virtualUnit ? null : input.unit.id, unit_label: input.unit.label,
      fitting_type_id: input.fittingTypeId, brand_id: input.brandId, model: input.model,
      current_finish_id: input.finishId, idem_key: `fitting:${input.id}`, captured_at: now,
    }, label)
    if (input.conditionIds.length) {
      await enqueue(tx, input.survey.id, 'conditions', { fitting_id: input.id, flag_ids: input.conditionIds }, `${label} · condition`)
    }
    for (const d of drafts) {
      const attId = uuid()
      await tx.runAsync(
        `INSERT INTO attachments (id, survey_id, fitting_id, slot, local_uri, sha256, bytes, width, height, lat, lng, accuracy_m, device_id, captured_at, storage_path)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        attId, input.survey.id, input.id, d.slot, d.local_uri, d.sha256, d.bytes, d.width, d.height, d.lat, d.lng, d.accuracy_m,
        dev, d.captured_at, photoPath(input.survey.id, input.id, d.slot, d.sha256),
      )
      await enqueue(tx, input.survey.id, 'photo', { attachment_id: attId }, `${label} · ${SLOT_LABEL[d.slot as Slot]}`)
    }
    await enqueue(tx, input.survey.id, 'assessment', {
      fitting_id: input.id, recommended: input.recommended, finish_id: input.targetFinishId,
      surveyor_note: input.surveyorNote, part_unavailable_note: input.partUnavailableNote,
    }, `${label} · assessment`)
    await tx.runAsync('DELETE FROM draft_photos WHERE fitting_id = ?', input.id)
    await tx.runAsync('DELETE FROM kv WHERE key = ?', `draft_unit:${input.id}`)
  })
  emitChange()
}

/** BR-S6: only callable once every attachment is synced — the screen gates it, and so does this. */
export async function queueSubmit(survey: LocalSurvey) {
  const s = await surveySync(survey.id)
  if (s.pending > 0 || s.failed > 0) throw new Error('Some work is still uploading. Submit unlocks when everything is synced.')
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('UPDATE surveys SET submit_queued_at = ? WHERE id = ?', new Date().toISOString(), survey.id)
    await enqueue(tx, survey.id, 'submit', { survey_id: survey.id }, `Submit · ${survey.property_name ?? ''}`)
  })
  emitChange()
}
