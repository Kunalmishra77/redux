// pnpm demo:refresh — moves the whole demo story forward so that "today" in the data is today.
// Run it on the morning of a demo: SLA timers, today's surveys, follow-ups due, quote validity,
// job downtime and warranty dates all shift by the same number of whole days, so every relative
// fact ("3d late", "valid 14 more days", "Room 102 blocked 2 days") stays exactly as seeded.
//
// Staging only. Triggers are switched off for the shift and on again in the same transaction, so
// guards (immutability, audit, updated_at) neither fire nor are left disabled.
import pg from 'pg'
import { assertStaging } from './seed-base'

async function main() {
  assertStaging()
  const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
  await db.connect()
  try {
    await db.query('begin')
    const anchor = await db.query<{ days: number; at: string }>(`
      select ((now() at time zone 'Asia/Kolkata')::date
              - coalesce((select (value #>> '{}')::date from public.settings where key = 'demo_anchor_date'),
                         (select ((value #>> '{}')::timestamptz at time zone 'Asia/Kolkata')::date from public.settings where key = 'demo_seeded_at'))) as days`)
    // --check: shift one day inside the transaction, then roll back — proves the move works
    const check = process.argv.includes('--check')
    const days = check ? 1 : Number(anchor.rows[0]?.days ?? 0)
    if (!Number.isFinite(days)) throw new Error('No demo on this database (settings.demo_seeded_at missing)')
    if (days <= 0) {
      console.log('• the demo is already dated today — nothing to move')
      await db.query('rollback')
      return
    }

    const cols = await db.query<{ table_name: string; column_name: string; data_type: string }>(`
      select c.table_name, c.column_name, c.data_type
      from information_schema.columns c
      join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
      where c.table_schema = 'public' and c.is_generated = 'NEVER'
        and c.data_type in ('timestamp with time zone', 'date')
        and c.table_name not in ('settings', 'invoice_series')   -- FY boundaries are calendar facts, not story dates
      order by c.table_name, c.column_name`)
    const byTable = new Map<string, { column_name: string; data_type: string }[]>()
    for (const r of cols.rows) byTable.set(r.table_name, [...(byTable.get(r.table_name) ?? []), r])

    let moved = 0
    for (const [table, list] of byTable) {
      const set = list.map((c) => `"${c.column_name}" = "${c.column_name}" + ${c.data_type === 'date' ? `${days}` : `interval '${days} days'`}`).join(', ')
      await db.query(`alter table public."${table}" disable trigger user`)
      // surveys carry an exclusion constraint (one surveyor, one slot): moving rows one by one can
      // land a row on a slot another row still holds, so park them far away first, then bring back
      const PARK = 36500
      const shift = (n: number) => list.map((c) => `"${c.column_name}" = "${c.column_name}" + ${c.data_type === 'date' ? `${n}` : `interval '${n} days'`}`).join(', ')
      if (table === 'surveys') await db.query(`update public."${table}" set ${shift(PARK)}`)
      const r = await db.query(`update public."${table}" set ${table === 'surveys' ? shift(days - PARK) : set}`)
      await db.query(`alter table public."${table}" enable trigger user`)
      moved += r.rowCount ?? 0
    }
    await db.query(`insert into public.settings (key, value, description)
      values ('demo_anchor_date', to_jsonb(((now() at time zone 'Asia/Kolkata')::date)::text), 'Demo data is dated as of this day (pnpm demo:refresh)')
      on conflict (key) do update set value = excluded.value`)
    if (check) {
      await db.query('rollback')
      console.log(`✓ check passed — a ${days}-day move touched ${moved} rows across ${byTable.size} tables (rolled back)`)
      return
    }
    await db.query('commit')
    console.log(`✓ moved the demo forward ${days} day${days === 1 ? '' : 's'} — ${moved} rows across ${byTable.size} tables`)
  } catch (e) {
    await db.query('rollback')
    throw e
  } finally {
    await db.end()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
