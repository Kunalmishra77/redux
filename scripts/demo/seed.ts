// pnpm demo:seed — builds the whole demo on STAGING. Everything is removed by resetting staging
// (scripts/demo/README.md). Safe to re-run: the story is only written once.
import pg from 'pg'
import { assertStaging, ensureUsers, hookIsOn, seedBase } from './seed-base'
import { backdate, seedFlows } from './seed-flows'

async function main() {
  assertStaging()
  const ids = await ensureUsers()
  console.log('✓ demo logins:', Object.keys(ids).join(', '))

  const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
  await db.connect()
  try {
    await db.query('begin')
    await seedBase(db, ids)
    console.log('✓ cities, masters, rate card v1, settings, notice, integrations')

    const seeded = (await db.query(`select 1 from public.settings where key = 'demo_seeded_at'`)).rowCount
    if (seeded) {
      console.log('• the demo story is already on staging — reset staging to re-seed it')
    } else {
      const leadIds = await seedFlows(db, ids)
      await backdate(db, leadIds)
      await db.query(`insert into public.settings (key, value, description) values ('demo_seeded_at', to_jsonb(now()::text), 'Demo data present — reset staging to remove it')`)
      console.log(`✓ the story: ${Object.keys(leadIds).length} leads through surveys, quotes, jobs, invoices, stock and service requests`)
    }
    await db.query('commit')
  } catch (e) {
    await db.query('rollback')
    throw e
  } finally {
    await db.end()
  }

  const on = await hookIsOn('vikram@redux.demo')
  console.log(on
    ? '✓ the auth hook is on — logins carry user_role'
    : '✗ the Custom Access Token Hook is OFF — demo logins will see nothing until it is switched on')
}

main().catch((e) => { console.error(e); process.exit(1) })
