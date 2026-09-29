import * as SQLite from 'expo-sqlite'

// On-device store (ADR-005/006, 04-offline-surveyor-app.md §1). Everything the surveyor sees is
// read from here; every write lands here first and reaches the server only through `outbox`.
// A logout never clears this database — the outbox survives sign-out, updates and restarts.

export const db = SQLite.openDatabaseSync('redux-surveyor.db')

const SCHEMA_VERSION = 1

const V1 = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT);

CREATE TABLE IF NOT EXISTS surveys (
  id TEXT PRIMARY KEY NOT NULL,
  surveyor_id TEXT,
  status TEXT NOT NULL,
  scheduled_at TEXT NOT NULL,
  slot_end_at TEXT,
  property_id TEXT NOT NULL,
  property_name TEXT,
  address TEXT,
  lat REAL,
  lng REAL,
  unit_label TEXT NOT NULL DEFAULT 'Room',
  customer_name TEXT,
  customer_type TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  checked_in_at TEXT,
  checkin_accuracy_m REAL,
  submit_queued_at TEXT,
  submitted_at TEXT,
  synced_at TEXT
);

CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY NOT NULL,
  property_id TEXT NOT NULL,
  label TEXT NOT NULL,
  floor TEXT,
  is_local INTEGER NOT NULL DEFAULT 0,
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS units_property_idx ON units (property_id);

CREATE TABLE IF NOT EXISTS fitting_types (id TEXT PRIMARY KEY NOT NULL, code TEXT, name TEXT NOT NULL, sort_order INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS brands (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS finishes (id TEXT PRIMARY KEY NOT NULL, code TEXT, name TEXT NOT NULL, hex TEXT);
CREATE TABLE IF NOT EXISTS condition_flags (id TEXT PRIMARY KEY NOT NULL, code TEXT, name TEXT NOT NULL, sort_order INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS rate_card_items (fitting_type_id TEXT NOT NULL, work_type_code TEXT NOT NULL, finish_id TEXT, price TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS market_prices (fitting_type_id TEXT NOT NULL, finish_id TEXT, price TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS fittings (
  id TEXT PRIMARY KEY NOT NULL,
  survey_id TEXT NOT NULL,
  unit_id TEXT,
  unit_label TEXT,
  fitting_type_id TEXT NOT NULL,
  brand_id TEXT,
  model TEXT,
  finish_id TEXT,
  notes TEXT,
  captured_at TEXT NOT NULL,
  from_server INTEGER NOT NULL DEFAULT 0,
  server_slots INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS fittings_survey_idx ON fittings (survey_id);

CREATE TABLE IF NOT EXISTS fitting_conditions (fitting_id TEXT NOT NULL, flag_id TEXT NOT NULL, PRIMARY KEY (fitting_id, flag_id));

CREATE TABLE IF NOT EXISTS assessments (
  fitting_id TEXT PRIMARY KEY NOT NULL,
  recommended TEXT NOT NULL,
  target_finish_id TEXT,
  surveyor_note TEXT,
  part_unavailable_note TEXT,
  price_recommended TEXT,
  price_replace_eurobrass TEXT,
  price_market_replacement TEXT,
  you_save TEXT,
  from_server INTEGER NOT NULL DEFAULT 0
);

-- Photos taken for a fitting that has not been saved yet. Written the moment the photo is
-- compressed, so leaving the screen (or the app dying) never loses a shot.
CREATE TABLE IF NOT EXISTS draft_photos (
  fitting_id TEXT NOT NULL,
  survey_id TEXT NOT NULL,
  slot TEXT NOT NULL,
  local_uri TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  bytes INTEGER,
  width INTEGER,
  height INTEGER,
  lat REAL, lng REAL, accuracy_m REAL,
  captured_at TEXT NOT NULL,
  PRIMARY KEY (fitting_id, slot)
);

-- 04-offline-surveyor-app.md §1: the attachment state machine
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY NOT NULL,
  survey_id TEXT NOT NULL,
  fitting_id TEXT NOT NULL,
  slot TEXT NOT NULL CHECK (slot IN ('front','side','top','close_up')),
  local_uri TEXT,
  sha256 TEXT NOT NULL,
  bytes INTEGER,
  width INTEGER,
  height INTEGER,
  lat REAL, lng REAL, accuracy_m REAL,
  device_id TEXT,
  captured_at TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'  -- pending | uploaded | synced
);
CREATE INDEX IF NOT EXISTS attachments_fitting_idx ON attachments (fitting_id);
CREATE INDEX IF NOT EXISTS attachments_survey_idx ON attachments (survey_id, status);

-- The outbox: every server write, in order. Drained FIFO per survey; a failure stops that
-- survey's queue (later rows depend on earlier ones) and never drops anything.
CREATE TABLE IF NOT EXISTS outbox (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  survey_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  label TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | done | failed
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  done_at TEXT
);
CREATE INDEX IF NOT EXISTS outbox_status_idx ON outbox (status, seq);
`

let ready: Promise<void> | null = null

/** Idempotent, versioned migration. Runs on every launch; an app update keeps the outbox. */
export function initDb(): Promise<void> {
  ready ??= (async () => {
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version')
    const current = row?.user_version ?? 0
    if (current < 1) await db.execAsync(V1)
    if (current < SCHEMA_VERSION) await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`)
  })()
  return ready
}

export async function kvGet(key: string): Promise<string | null> {
  const r = await db.getFirstAsync<{ value: string | null }>('SELECT value FROM kv WHERE key = ?', key)
  return r?.value ?? null
}

export async function kvSet(key: string, value: string | null): Promise<void> {
  await db.runAsync('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value)
}
