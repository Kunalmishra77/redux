import { File } from 'expo-file-system'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import * as Network from 'expo-network'
import { useEffect, useState } from 'react'
import { db } from './db'
import { emitChange } from './events'
import { PHOTO_BUCKET, supabase } from './supabase'

// The outbox drain (04-offline-surveyor-app.md §1, CLAUDE.md rule 7).
//  * FIFO per survey. A failure stops THAT survey's queue — later rows depend on earlier ones
//    (a fitting needs its check-in, a photo row needs its fitting) — other surveys carry on.
//  * Every step is idempotent: client-generated ids, unique idem_keys, sha256 storage paths.
//    A retry after a lost response is a no-op on the server, never a duplicate.
//  * Exponential backoff with jitter; after MAX_ATTEMPTS the row is "needs attention" with a
//    Retry — never silently dropped.
//  * Photos (rule 8): upload → confirm the object exists → insert the fitting_photos row →
//    ONLY THEN delete the local file.

const MAX_ATTEMPTS = 5

type OutboxRow = {
  seq: number
  id: string
  survey_id: string
  kind: string
  payload: string
  label: string | null
  status: string
  attempts: number
  next_attempt_at: number
  last_error: string | null
}

type Attachment = {
  id: string
  survey_id: string
  fitting_id: string
  slot: string
  local_uri: string | null
  sha256: string
  bytes: number | null
  width: number | null
  height: number | null
  lat: number | null
  lng: number | null
  accuracy_m: number | null
  device_id: string | null
  captured_at: string
  storage_path: string
  status: string
}

class SyncError extends Error {
  constructor(message: string, readonly kind: 'network' | 'auth' | 'server', readonly code?: string) {
    super(message)
  }
}

// ---------------------------------------------------------------------------
// Observable state for the header chip and the Sync screen
// ---------------------------------------------------------------------------
export type SyncState = {
  online: boolean
  running: boolean
  current: string | null
  needsLogin: boolean
  lastSyncAt: string | null
  lastProblem: string | null
}

let state: SyncState = { online: true, running: false, current: null, needsLogin: false, lastSyncAt: null, lastProblem: null }
const listeners = new Set<(s: SyncState) => void>()

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch }
  for (const l of listeners) l(state)
}

export const getSyncState = () => state

export function useSyncState(): SyncState {
  const [s, setS] = useState(state)
  useEffect(() => {
    listeners.add(setS)
    return () => void listeners.delete(setS)
  }, [])
  return s
}

// ---------------------------------------------------------------------------
// Error classification — no raw error strings reach the surveyor
// ---------------------------------------------------------------------------
type AnyErr = { message?: string; code?: string; status?: number; statusCode?: string; name?: string } | null | undefined

function isNetworkMessage(msg: string) {
  return /network request failed|failed to fetch|fetch failed|load failed|network error|timed? ?out|aborted|ENOTFOUND|ECONN/i.test(msg)
}

function classify(err: AnyErr, context: string): SyncError {
  const msg = err?.message ?? String(err)
  const code = err?.code ?? err?.statusCode
  if (isNetworkMessage(msg) || err?.name === 'StorageUnknownError') return new SyncError('No connection to the server.', 'network', code)
  if (code === 'PGRST301' || code === 'PGRST303' || err?.status === 401 || /jwt|refresh token/i.test(msg)) {
    return new SyncError('Your session has expired. Sign in again — nothing on this phone is lost.', 'auth', code)
  }
  if (/bucket not found/i.test(msg)) {
    return new SyncError(`Photo storage isn't set up on the server yet (bucket "${PHOTO_BUCKET}"). Photos are safe on this phone.`, 'server', code)
  }
  if (code === '42501' || err?.status === 403 || /row-level security|not allowed|only the assigned/i.test(msg)) {
    return new SyncError(`The server refused the ${context} (permission). It's saved here — tell the office.`, 'server', code)
  }
  if (code === '23514' || code === '22023' || code === 'P0002' || code === '55000') {
    // Business-rule refusals raised by our own functions — their messages are written for people
    return new SyncError(msg.replace(/\s*\(BR-[A-Z0-9, ]+\)/g, ''), 'server', code)
  }
  return new SyncError(`Couldn't save the ${context}. It's saved here — we'll retry.`, 'server', code)
}

const isDuplicate = (err: AnyErr) => err?.code === '23505'

// ---------------------------------------------------------------------------
// One outbox row
// ---------------------------------------------------------------------------
async function processRow(row: OutboxRow): Promise<void> {
  const p = JSON.parse(row.payload)
  switch (row.kind) {
    case 'checkin': {
      const { error } = await supabase.from('survey_checkins').insert(p)
      if (error && !isDuplicate(error)) throw classify(error, 'check-in')
      return
    }
    case 'unit': {
      const { error } = await supabase.from('property_units').insert(p)
      if (!error) return
      if (!isDuplicate(error)) throw classify(error, 'new unit')
      // Either our own retry (same id) or the label already exists on the server under another id
      const { data: mine } = await supabase.from('property_units').select('id').eq('id', p.id).maybeSingle()
      if (mine) return
      const { data: theirs, error: e2 } = await supabase
        .from('property_units').select('id').eq('property_id', p.property_id).eq('label', p.label).maybeSingle()
      if (e2 || !theirs) throw classify(e2 ?? error, 'new unit')
      await remapUnit(p.id, theirs.id as string)
      return
    }
    case 'fitting': {
      const { error } = await supabase.from('fittings').insert(p)
      if (error && !isDuplicate(error)) throw classify(error, 'fitting')
      return
    }
    case 'conditions': {
      const rows = (p.flag_ids as string[]).map((id) => ({ fitting_id: p.fitting_id, condition_flag_id: id }))
      const { error } = await supabase
        .from('fitting_conditions')
        .upsert(rows, { onConflict: 'fitting_id,condition_flag_id', ignoreDuplicates: true })
      if (error && !isDuplicate(error)) throw classify(error, 'condition checklist')
      return
    }
    case 'photo':
      return syncPhoto(p.attachment_id as string)
    case 'assessment': {
      const { error } = await supabase.rpc('upsert_assessment', { p })
      if (error) throw classify(error, 'assessment')
      // The server re-prices from the active rate card — take its numbers as the truth
      const { data } = await supabase
        .from('assessments')
        .select('p_rec:price_recommended::text, p_rep:price_replace_eurobrass::text, p_mkt:price_market_replacement::text, save:you_save::text')
        .eq('fitting_id', p.fitting_id)
        .maybeSingle()
      if (data) {
        const d = data as Record<string, string | null>
        await db.runAsync(
          `UPDATE assessments SET price_recommended = ?, price_replace_eurobrass = ?, price_market_replacement = ?, you_save = ?, from_server = 1 WHERE fitting_id = ?`,
          d.p_rec, d.p_rep, d.p_mkt, d.save, p.fitting_id,
        )
      }
      return
    }
    case 'submit': {
      const { error } = await supabase.rpc('submit_survey', { p_survey_id: p.survey_id })
      if (error) {
        // A retry after a lost response: the survey is already submitted — that is success
        const { data } = await supabase.from('surveys').select('status').eq('id', p.survey_id).maybeSingle()
        if (data?.status !== 'submitted') {
          await db.runAsync('UPDATE surveys SET submit_queued_at = NULL WHERE id = ?', p.survey_id)
          throw classify(error, 'survey submission')
        }
      }
      await db.runAsync(
        `UPDATE surveys SET status = 'submitted', submitted_at = ?, submit_queued_at = NULL WHERE id = ?`,
        new Date().toISOString(), p.survey_id,
      )
      return
    }
    default:
      throw new SyncError(`Unknown outbox item "${row.kind}"`, 'server')
  }
}

/** The server already had this unit label under another id — point everything local at the server's. */
async function remapUnit(localId: string, serverId: string) {
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('UPDATE fittings SET unit_id = ? WHERE unit_id = ?', serverId, localId)
    await tx.runAsync(`UPDATE outbox SET payload = replace(payload, ?, ?) WHERE status <> 'done'`, localId, serverId)
    await tx.runAsync(`UPDATE kv SET value = ? WHERE key LIKE 'draft_unit:%' AND value = ?`, serverId, localId)
    const exists = await tx.getFirstAsync('SELECT 1 FROM units WHERE id = ?', serverId)
    if (exists) await tx.runAsync('DELETE FROM units WHERE id = ?', localId)
    else await tx.runAsync('UPDATE units SET id = ?, is_local = 0 WHERE id = ?', serverId, localId)
  })
}

/** Rule 8: the local file is deleted ONLY after the remote object is confirmed and its row exists. */
async function syncPhoto(attachmentId: string): Promise<void> {
  const a = await db.getFirstAsync<Attachment>('SELECT * FROM attachments WHERE id = ?', attachmentId)
  if (!a) throw new SyncError('Photo record missing on this phone.', 'server')
  if (a.status === 'synced') return
  const bucket = supabase.storage.from(PHOTO_BUCKET)

  if (a.status === 'pending') {
    const file = a.local_uri ? new File(a.local_uri) : null
    if (file?.exists) {
      const bytes = await file.bytes()
      // React Native's fetch sends an ArrayBuffer body reliably (a typed-array view it may not)
      const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
      const { error } = await bucket.upload(a.storage_path, body, { contentType: 'image/jpeg', upsert: false })
      // sha256 in the path: 409 means these exact bytes are already there — success (05-storage-media §2)
      const e = error as AnyErr
      const already = e && (e.statusCode === '409' || e.status === 409 || e.code === 'ResourceAlreadyExists' || /already exists|duplicate/i.test(e.message ?? ''))
      if (error && !already) throw classify(e, 'photo upload')
    }
    // Confirm the object really exists before anything else (covers "uploaded but confirm failed")
    const { data: exists, error: exErr } = await bucket.exists(a.storage_path)
    if (exErr && isNetworkMessage(exErr.message)) throw classify(exErr as AnyErr, 'photo check')
    if (!exists) {
      if (!file?.exists) throw new SyncError('This photo file is missing from the phone and was never uploaded. Retake it.', 'server')
      throw new SyncError("The upload didn't arrive. It's saved here — we'll retry.", 'server')
    }
    await db.runAsync(`UPDATE attachments SET status = 'uploaded' WHERE id = ?`, a.id)
  }

  // Record the photo (insert-only table, BR-S7). The attachment id is the row id → a retry is a duplicate, i.e. success.
  const { error } = await supabase.from('fitting_photos').insert({
    id: a.id, fitting_id: a.fitting_id, slot: a.slot, storage_path: a.storage_path, sha256: a.sha256,
    bytes: a.bytes, width: a.width, height: a.height, lat: a.lat, lng: a.lng, accuracy_m: a.accuracy_m,
    device_id: a.device_id, captured_at: a.captured_at,
  })
  if (error && !isDuplicate(error)) throw classify(error, 'photo record')

  // Only now: remote object confirmed + row recorded → the local copy may go.
  if (a.local_uri) {
    try {
      const f = new File(a.local_uri)
      if (f.exists) f.delete()
    } catch {
      // A leftover file is harmless; the reconciler reports it. Deleting early would not be.
    }
  }
  await db.runAsync(`UPDATE attachments SET status = 'synced', local_uri = NULL WHERE id = ?`, a.id)
}

// ---------------------------------------------------------------------------
// The drain loop
// ---------------------------------------------------------------------------
let draining: Promise<void> | null = null
let again = false

function backoffMs(attempts: number) {
  const base = Math.min(5_000 * 4 ** (attempts - 1), 15 * 60_000)
  return Math.round(base * (0.75 + Math.random() * 0.5)) // jitter
}

export function drain(): Promise<void> {
  if (draining) {
    again = true
    return draining
  }
  draining = (async () => {
    let awake = false
    try {
      do {
        again = false
        await drainOnce(async () => {
          if (!awake) {
            awake = true
            await activateKeepAwakeAsync('redux-sync').catch(() => undefined)
          }
        })
      } while (again)
    } finally {
      if (awake) deactivateKeepAwake('redux-sync')
      setState({ running: false, current: null })
      draining = null
    }
  })()
  return draining
}

async function drainOnce(onWork: () => Promise<void>) {
  const { data: sess } = await supabase.auth.getSession()
  if (!sess.session) {
    const pending = await db.getFirstAsync<{ n: number }>(`SELECT count(*) AS n FROM outbox WHERE status = 'pending'`)
    setState({ needsLogin: (pending?.n ?? 0) > 0 })
    return
  }
  const rows = await db.getAllAsync<OutboxRow>(`SELECT * FROM outbox WHERE status <> 'done' ORDER BY seq`)
  if (rows.length === 0) {
    setState({ lastSyncAt: new Date().toISOString(), lastProblem: null })
    return
  }
  const blocked = new Set<string>()
  let problem: string | null = null
  for (const row of rows) {
    if (blocked.has(row.survey_id)) continue
    if (row.status === 'failed' || row.next_attempt_at > Date.now()) {
      blocked.add(row.survey_id)
      continue
    }
    await onWork()
    setState({ running: true, current: row.label })
    try {
      await processRow(row)
      await db.runAsync(`UPDATE outbox SET status = 'done', done_at = ?, last_error = NULL WHERE seq = ?`, new Date().toISOString(), row.seq)
      setState({ online: true, needsLogin: false })
      emitChange()
    } catch (e) {
      const err = e instanceof SyncError ? e : classify(e as AnyErr, 'change')
      if (err.kind === 'network') {
        setState({ online: false })
        return // no signal: stop everything, try again when the network comes back
      }
      if (err.kind === 'auth') {
        const { error: refreshErr } = await supabase.auth.refreshSession()
        if (!refreshErr) {
          again = true
          return
        }
        setState({ needsLogin: true })
        return
      }
      const attempts = row.attempts + 1
      await db.runAsync(
        `UPDATE outbox SET attempts = ?, next_attempt_at = ?, last_error = ?, status = ? WHERE seq = ?`,
        attempts, Date.now() + backoffMs(attempts), err.message, attempts >= MAX_ATTEMPTS ? 'failed' : 'pending', row.seq,
      )
      problem = err.message
      blocked.add(row.survey_id)
      emitChange()
    }
  }
  setState({ lastSyncAt: new Date().toISOString(), lastProblem: problem })
}

/** "Retry" on the needs-attention screen: back into the queue with a fresh attempt budget. */
export async function retryFailed(seq?: number) {
  if (seq === undefined) {
    await db.runAsync(`UPDATE outbox SET status = 'pending', attempts = 0, next_attempt_at = 0 WHERE status IN ('failed','pending')`)
  } else {
    await db.runAsync(`UPDATE outbox SET status = 'pending', attempts = 0, next_attempt_at = 0 WHERE seq = ?`, seq)
  }
  emitChange()
  void drain()
}

// ---------------------------------------------------------------------------
// Triggers: network comes back, app start, periodic tick while the app is open
// ---------------------------------------------------------------------------
let started = false

export function startSync() {
  if (started) return
  started = true
  Network.getNetworkStateAsync()
    .then((n) => {
      setState({ online: n.isConnected !== false && n.isInternetReachable !== false })
    })
    .catch(() => undefined)
  Network.addNetworkStateListener((n) => {
    const online = n.isConnected !== false && n.isInternetReachable !== false
    const wasOffline = !state.online
    setState({ online })
    if (online && wasOffline) void drain()
  })
  setInterval(() => void drain(), 20_000)
  void drain()
}

// ---------------------------------------------------------------------------
// Counts for the header chip and Sync screen
// ---------------------------------------------------------------------------
export type SyncCounts = { pending: number; failed: number; photosPending: number; photosTotal: number; photosDone: number }

export async function syncCounts(): Promise<SyncCounts> {
  const o = await db.getFirstAsync<{ pending: number; failed: number }>(
    `SELECT coalesce(sum(status = 'pending'), 0) AS pending, coalesce(sum(status = 'failed'), 0) AS failed FROM outbox`,
  )
  // Progress counts photos of surveys that still have something to send ("187 / 200")
  const a = await db.getFirstAsync<{ total: number; done: number }>(
    `SELECT count(*) AS total, coalesce(sum(status = 'synced'), 0) AS done FROM attachments
     WHERE survey_id IN (SELECT survey_id FROM attachments WHERE status <> 'synced')`,
  )
  return {
    pending: o?.pending ?? 0,
    failed: o?.failed ?? 0,
    photosPending: (a?.total ?? 0) - (a?.done ?? 0),
    photosTotal: a?.total ?? 0,
    photosDone: a?.done ?? 0,
  }
}
