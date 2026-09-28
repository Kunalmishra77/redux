// Development-only DNS fix. Some Indian ISPs hijack DNS for *.supabase.co (every resolver, even
// 8.8.8.8, answers with a non-Supabase address and TLS then fails). This preload resolves
// *.supabase.co over DNS-over-HTTPS (Cloudflare, then Google) and hands Node the real address.
// Nothing else changes: TLS still verifies the real certificate for the real hostname.
//
// Loaded by `pnpm dev` / the scripts through NODE_OPTIONS=--import. Never used on Vercel.
import dns from 'node:dns'
import https from 'node:https'

const originalLookup = dns.lookup
const cache = new Map() // host → { address, expires }

function doh(host, endpoint) {
  return new Promise((resolve, reject) => {
    const req = https.get(`${endpoint}?name=${encodeURIComponent(host)}&type=A`,
      { headers: { accept: 'application/dns-json' }, lookup: originalLookup, timeout: 8000 },
      (res) => {
        let body = ''
        res.on('data', (c) => (body += c))
        res.on('end', () => {
          try {
            const answer = (JSON.parse(body).Answer ?? []).find((a) => a.type === 1)
            if (!answer) return reject(new Error(`no A record for ${host}`))
            resolve({ address: answer.data, ttl: answer.TTL ?? 300 })
          } catch (e) { reject(e) }
        })
      })
    req.on('timeout', () => req.destroy(new Error('DoH timeout')))
    req.on('error', reject)
  })
}

async function resolveReal(host) {
  const hit = cache.get(host)
  if (hit && hit.expires > Date.now()) return hit.address
  let result
  try { result = await doh(host, 'https://cloudflare-dns.com/dns-query') }
  catch { result = await doh(host, 'https://dns.google/resolve') }
  cache.set(host, { address: result.address, expires: Date.now() + result.ttl * 1000 })
  return result.address
}

function patchedLookup(hostname, options, callback) {
  if (typeof options === 'function') { callback = options; options = {} }
  if (typeof options === 'number') options = { family: options }
  if (typeof hostname !== 'string' || !/(^|\.)supabase\.co$/i.test(hostname)) {
    return originalLookup(hostname, options, callback)
  }
  resolveReal(hostname).then(
    (address) => options?.all ? callback(null, [{ address, family: 4 }]) : callback(null, address, 4),
    (err) => callback(err),
  )
}

dns.lookup = patchedLookup
dns.promises.lookup = (hostname, options = {}) =>
  new Promise((resolve, reject) => patchedLookup(hostname, options, (err, address, family) =>
    err ? reject(err) : resolve(Array.isArray(address) ? address : { address, family })))
