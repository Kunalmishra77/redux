// CR-001 phases 7–9 extras on the LIVE demo, in a real browser: catalog import → publish → website →
// unpublish (and clean up), "Assess this fitting" on a product page, programme pages, and a scheduled
// campaign going out through the database scheduler (pg_cron) without anyone pressing Send.
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const B = process.env.BASE ?? 'https://redux-demo-iota.vercel.app'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)
const must = (cond, msg) => { if (!cond) throw new Error('ASSERT: ' + msg) }
const browser = await chromium.launch()
const toast = (p, re) => p.locator('[data-sonner-toast]').filter({ hasText: re }).first().waitFor({ timeout: 60000 })

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const sp = await ctx.newPage()
await sp.goto(B + '/staff/login', { waitUntil: 'networkidle' })
await sp.getByRole('button', { name: /Vikram Sethi/ }).click()
await sp.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 60000 })

// 1 ── catalog import from a CSV file (a draft QA product), publish, see it, unpublish, remove
const SKU = 'QA-CHECK-' + Date.now().toString().slice(-6)
const dir = mkdtempSync(join(tmpdir(), 'redux-qa-'))
const file = join(dir, 'catalog.csv')
writeFileSync(file, `sku,name,category,fitting_type,description,benefits,finishes,published\r\n${SKU},QA Thermostatic Mixer,mixers,shower_mixer,"QA row, safe to delete",Quiet|Even temperature,chrome,no\r\nBAD SKU!,Broken row,mixers,,,,,\r\n`)
await sp.goto(B + '/staff/admin/catalog', { waitUntil: 'networkidle' })
await sp.locator('#cat-file').setInputFiles(file)
await toast(sp, /1 added/)
must(await sp.getByText(/Row 2/).count(), 'the bad row is reported')
await sp.reload({ waitUntil: 'networkidle' })
const row = sp.locator('tr', { hasText: 'QA Thermostatic Mixer' })
must(await row.getByText('Draft').count(), 'imported as a draft')
await row.getByRole('button', { name: 'Publish' }).click()
await toast(sp, /Published/)
const { data: prod } = await admin.from('products').select('id, slug').eq('sku', SKU).single()
let r = await fetch(`${B}/products/${prod.slug}`)
must(r.status === 200 && (await r.text()).includes('QA Thermostatic Mixer'), 'published product is on the website')
await sp.reload({ waitUntil: 'networkidle' })
await sp.locator('tr', { hasText: 'QA Thermostatic Mixer' }).getByRole('button', { name: 'Unpublish' }).click()
await toast(sp, /Taken off/)
r = await fetch(`${B}/products/${prod.slug}`)
must(r.status === 404, 'unpublished product is gone from the website, got ' + r.status)
await admin.from('product_media').delete().eq('product_id', prod.id)
await admin.from('products').delete().eq('id', prod.id)
log('1 catalog: CSV import (1 added, bad row reported) → publish → on the website → unpublish → 404 ✓ (QA row removed)')

// 2 ── the website: product page CTA, programme pages
const wp = await (await browser.newContext({ viewport: { width: 400, height: 860 }, isMobile: true })).newPage()
await wp.goto(B + '/products/basin-mixer', { waitUntil: 'networkidle' })
await wp.getByRole('link', { name: 'Assess this fitting' }).or(wp.getByRole('button', { name: 'Assess this fitting' })).first().click()
await wp.getByText('Request a free assessment').first().waitFor({ timeout: 30000 })
for (const [path, text] of [['/assessment', 'Self-assessment'], ['/demo-programme', 'Room demo'], ['/referral-programme', '5% off their first order'], ['/products', 'What we restore.']]) {
  const res = await fetch(B + path); const html = await res.text()
  must(res.status === 200 && html.includes(text), `${path} shows "${text}"`)
}
const home = await (await fetch(B + '/')).text()
must(home.includes('Request an assessment') && !home.includes('Book free assessment'), 'CTA wording updated (C1)')
log('2 website: product page opens the assessment request; /assessment, /demo-programme, /referral-programme, /products ✓; CTA "Request an assessment" ✓')

// 3 ── a scheduled campaign goes out by itself (pg_cron, every 5 minutes)
const { data: tpl } = await admin.from('message_templates').select('code').eq('code', 'outreach_referral_invite').single()
const { data: cp, error } = await admin.from('outreach_campaigns').insert({
  name: 'QA — scheduled referral invite', channel: 'whatsapp', template_code: tpl.code,
  audience: { target: 'accounts', past_customers: true }, status: 'scheduled', scheduled_at: new Date(Date.now() - 60_000).toISOString(),
}).select('id').single()
must(!error, error?.message)
let status = 'scheduled'
for (let i = 0; i < 40 && status === 'scheduled'; i++) {
  await new Promise((res) => setTimeout(res, 15_000))
  status = (await admin.from('outreach_campaigns').select('status').eq('id', cp.id).single()).data.status
}
must(status === 'sent', 'the scheduler sent the campaign, status ' + status)
const { data: recs } = await admin.from('outreach_recipients').select('status, skip_reason').eq('campaign_id', cp.id)
log('3 scheduled campaign sent by pg_cron ✓ —', recs.length, 'recipients:', JSON.stringify(recs.reduce((m, x) => ({ ...m, [x.skip_reason ?? x.status]: (m[x.skip_reason ?? x.status] ?? 0) + 1 }), {})))
await browser.close()
log('EXTRAS COMPLETE')
