// CI gate 6 / BR-X2 / permission test P5: no server secret may reach a client bundle.
// Run after `next build`. CI builds with canary values in every secret env var, so a leaked
// value is caught even when the variable name is not.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = '.next/static'
const NAME_PATTERNS = [/SERVICE_ROLE/i, /[A-Z0-9]+_SECRET\b/]
const CANARIES = Object.entries(process.env)
  .filter(([key, value]) => value?.startsWith('ci-canary-') && key)
  .map(([key, value]) => ({ key, value }))

function* files(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) yield* files(path)
    else if (/\.(js|mjs|css|html|json|map)$/.test(entry)) yield path
  }
}

let scanned = 0
const leaks = []
for (const file of files(ROOT)) {
  scanned++
  const body = readFileSync(file, 'utf8')
  for (const pattern of NAME_PATTERNS) {
    const hit = body.match(pattern)
    if (hit) leaks.push(`${file}: secret-like name "${hit[0]}"`)
  }
  for (const { key, value } of CANARIES) {
    if (body.includes(value)) leaks.push(`${file}: value of ${key}`)
  }
}

if (scanned === 0) {
  console.error(`No client files under ${ROOT} — run \`next build\` first.`)
  process.exit(1)
}
if (leaks.length > 0) {
  console.error('Server secrets found in client bundles:\n' + leaks.join('\n'))
  process.exit(1)
}
console.log(`Client bundle clean: ${scanned} files, ${CANARIES.length} canaries checked.`)
