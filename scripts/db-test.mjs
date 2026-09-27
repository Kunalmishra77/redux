// Runs supabase/tests/*.test.sql (pgTAP) against a database URL, without Docker (ADR-013).
// `supabase test db` needs Docker for pg_prove; this runs the same files over a plain connection.
// Every test file wraps itself in begin … rollback, so running against staging leaves no trace.
//
//   pnpm db:test                    # uses SUPABASE_DB_URL from .env.local
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'

const url = process.env.SUPABASE_DB_URL
if (!url) {
  console.error('SUPABASE_DB_URL is not set (see .env.local)')
  process.exit(1)
}

const dir = 'supabase/tests'
const files = readdirSync(dir).filter((f) => f.endsWith('.test.sql')).sort()
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await client.connect()

let failed = 0
for (const file of files) {
  let results
  try {
    results = await client.query(readFileSync(join(dir, file), 'utf8'))
  } catch (error) {
    await client.query('rollback').catch(() => {})
    console.log(`✗ ${file}\n    ${error.message}`)
    failed++
    continue
  }

  const lines = (Array.isArray(results) ? results : [results])
    .flatMap((r) => r.rows ?? [])
    .flatMap((row) => Object.values(row))
    .filter((v) => typeof v === 'string')

  const bad = lines.filter((l) => /^not ok\b/.test(l) || /^# Looks like you (failed|planned)/.test(l))
  const passed = lines.filter((l) => /^ok\b/.test(l)).length
  if (bad.length > 0) {
    failed++
    console.log(`✗ ${file}`)
    for (const l of lines.filter((l) => !/^ok\b/.test(l))) console.log(`    ${l}`)
  } else {
    console.log(`✓ ${file} (${passed} passed)`)
  }
}

await client.end()
process.exit(failed > 0 ? 1 : 0)
