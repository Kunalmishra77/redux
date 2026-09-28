// Applies migration files inside ONE transaction and always rolls back — proves they apply on top
// of the target database's current state without changing it (no Docker needed, ADR-013).
// With --tests, also runs every supabase/tests/*.test.sql inside that same transaction, so new
// pgTAP tests can be proved against migrations that are not on staging yet.
//
//   pnpm db:dry-run supabase/migrations/2026…sql [...] [--tests]
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'

const args = process.argv.slice(2)
const withTests = args.includes('--tests')
const files = args.filter((a) => a !== '--tests')
if (files.length === 0) {
  console.error('Pass one or more migration files.')
  process.exit(1)
}

const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
await client.connect()
await client.query('begin')

let failed = false
for (const file of files) {
  try {
    await client.query(readFileSync(file, 'utf8'))
    console.log(`✓ ${file}`)
  } catch (error) {
    failed = true
    console.log(`✗ ${file}\n    ${error.message}${error.where ? `\n    at: ${error.where}` : ''}`)
    break
  }
}

if (!failed && withTests) {
  const dir = 'supabase/tests'
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.test.sql')).sort()) {
    // Each test file wraps itself in begin … rollback; here it runs in a savepoint instead
    const body = readFileSync(join(dir, file), 'utf8')
      .replace(/^\s*begin\s*;\s*$/im, '')
      .replace(/^\s*rollback\s*;\s*$/im, '')
    await client.query('savepoint t')
    try {
      const results = await client.query(body)
      const lines = (Array.isArray(results) ? results : [results])
        .flatMap((r) => r.rows ?? [])
        .flatMap((row) => Object.values(row))
        .filter((v) => typeof v === 'string')
      const bad = lines.filter((l) => /^not ok\b/.test(l) || /^# Looks like you (failed|planned)/.test(l))
      if (bad.length > 0) {
        failed = true
        console.log(`✗ ${file}`)
        for (const l of lines.filter((l) => !/^ok\b/.test(l))) console.log(`    ${l}`)
      } else {
        console.log(`✓ ${file} (${lines.filter((l) => /^ok\b/.test(l)).length} passed)`)
      }
    } catch (error) {
      failed = true
      console.log(`✗ ${file}\n    ${error.message}`)
    }
    await client.query('rollback to savepoint t')
    await client.query('reset role')
  }
}

await client.query('rollback')
await client.end()
console.log('rolled back — nothing was changed')
process.exit(failed ? 1 : 0)
