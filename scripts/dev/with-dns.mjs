// Runs a command with the *.supabase.co DNS fix preloaded (see supabase-dns.mjs), in this process
// and every Node child it spawns (Next dev forks workers). Cross-platform: no VAR=x shell syntax.
//   node scripts/dev/with-dns.mjs next dev
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const preload = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), 'supabase-dns.mjs')).href
const env = { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import ${preload}`.trim() }
const [cmd, ...args] = process.argv.slice(2)
const child = spawn(cmd, args, { stdio: 'inherit', env, shell: process.platform === 'win32' })
child.on('exit', (code) => process.exit(code ?? 0))
