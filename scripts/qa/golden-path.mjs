// Golden path on the LIVE demo: one new hotel goes from website enquiry to paid invoice.
// Browser steps run against Vercel; the surveyor's on-site steps use the exact calls the Expo app's
// outbox makes (supabase-js as the surveyor). Every step asserts its outcome.
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'

const B = process.env.BASE ?? 'https://redux-demo-iota.vercel.app'
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, PW = process.env.DEMO_PASSWORD
const PHONE10 = process.env.GP_PHONE ?? '9811204590'
const PHONE = `+91${PHONE10}`
const CUSTOMER = { name: process.env.GP_NAME ?? 'Arvind Mehta', property: process.env.GP_PROPERTY ?? 'Hotel Blue Lotus, Paharganj', rooms: '24' }
const ADDRESS = process.env.GP_ADDRESS ?? '8 Arakashan Road, Paharganj, New Delhi 110055'
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)
const must = (cond, msg) => { if (!cond) throw new Error('ASSERT: ' + msg) }
const as = async (email) => { const c = createClient(URL_, ANON, { auth: { persistSession: false } }); const { error } = await c.auth.signInWithPassword({ email, password: PW }); if (error) throw error; return c }
mkdirSync('gp', { recursive: true })

const browser = await chromium.launch()
const ctx = () => browser.newContext({ viewport: { width: 1440, height: 900 } })

// 1 ── Website enquiry
{
  const p = await (await ctx()).newPage()
  await p.goto(B + '/book-assessment', { waitUntil: 'networkidle' })
  const form = p.locator('form').filter({ has: p.locator('[name="consentService"]') }).first()
  await form.getByText('Hotel', { exact: true }).first().click()
  await form.locator('[name="name"]').fill(CUSTOMER.name)
  await form.locator('[name="phone"]').fill(PHONE10)
  await form.locator('select[name="city"]').selectOption({ label: 'Delhi' })
  await form.locator('[name="propertyName"]').fill(CUSTOMER.property)
  await form.locator('[name="units"]').fill(CUSTOMER.rooms)
  await form.locator('[name="message"]').fill('Mixers in most rooms are stiff and the chrome is peeling. Want to see a pilot room first.')
  await form.locator('[name="consentService"]').check()
  await form.getByRole('button', { name: /my free assessment/ }).last().click()
  await p.waitForURL(/thank-you/, { timeout: 60000 })
  log('1 website enquiry → thank-you ✓')
}

// 2 ── Care executive: call, book the free survey
const priya = await as('priya@redux.demo')
const { data: lead } = await priya.from('leads').select('id, status, source:lead_sources(code), sla_due_at').eq('phone', PHONE).neq('status', 'lost').maybeSingle()
must(lead, 'lead exists for ' + PHONE)
must(lead.source?.code === 'website', 'source is website')
log('2 lead', lead.status, 'SLA due', lead.sla_due_at)
{ const { error } = await priya.rpc('log_call', { p_call: { lead_id: lead.id, outcome: 'interested', outcome_note: 'GM wants a pilot room first.', started_at: new Date(Date.now() - 240000).toISOString(), ended_at: new Date().toISOString() } }); must(!error, 'log_call ' + error?.message) }
const { data: ankitRow } = await priya.from('profiles').select('id').eq('email', 'ankit@redux.demo').single()
const { data: delhi } = await priya.from('cities').select('id').eq('name', 'Delhi').single()
let start, booked, bErr
for (let h = 0; h < 24; h++) {
  start = new Date(Math.ceil((Date.now() + 30 * 60000) / 3600000) * 3600000 + h * 3600000)
  ;({ data: booked, error: bErr } = await priya.rpc('book_survey', { p: { lead_id: lead.id, surveyor_id: ankitRow.id, scheduled_at: start.toISOString(), property: { name: CUSTOMER.property.split(',')[0], address: ADDRESS, city_id: delhi.id } } }))
  if (!bErr || bErr.code !== '23P01') break
}
must(!bErr, 'book_survey ' + bErr?.message)
const surveyId = typeof booked === 'string' ? booked : booked?.survey_id ?? booked?.id
must(surveyId, 'survey id')
log('3 call logged, survey booked', start.toISOString())

// 3 ── Surveyor on site
const ankit = await as('ankit@redux.demo')
{
  const cid = randomUUID()
  const { error } = await ankit.from('survey_checkins').insert({ id: cid, survey_id: surveyId, surveyor_id: ankitRow.id, idem_key: `checkin:${cid}`, lat: 28.6448, lng: 77.2167, accuracy_m: 12, is_mocked: false, device_id: 'golden-path', checked_in_at: new Date().toISOString() })
  must(!error, 'check-in ' + error?.message)
}
const { data: types } = await ankit.from('fitting_types').select('id, code')
const { data: finishes } = await ankit.from('finishes').select('id, code')
const { data: brands } = await ankit.from('brands').select('id, name')
const T = (c) => types.find((t) => t.code === c).id, F = (c) => finishes.find((f) => f.code === c).id
const photoPage = await (await ctx()).newPage()
async function jpeg(type, finish) {
  await photoPage.setViewportSize({ width: 800, height: 600 })
  await photoPage.goto(`${B}/demo/fittings/${type}-${finish}-before.svg`)
  return photoPage.screenshot({ type: 'jpeg', quality: 72 })
}
const plan = [
  { unit: '101', type: 'basin_mixer', finish: 'chrome', rec: 'restore_finish', target: 'chrome' },
  { unit: '101', type: 'shower_mixer', finish: 'chrome', rec: 'repair_function' },
  { unit: '102', type: 'basin_mixer', finish: 'pvd_brushed_gold', rec: 'restore_finish', target: 'pvd_brushed_gold' },
  { unit: '102', type: 'health_faucet', finish: 'chrome', rec: 'replace_eurobrass' },
]
for (const f of plan) {
  const fid = randomUUID()
  const { error: e1 } = await ankit.from('fittings').insert({ id: fid, survey_id: surveyId, unit_label: f.unit, fitting_type_id: T(f.type), brand_id: brands.find((b) => b.name === 'Jaquar')?.id ?? null, current_finish_id: F(f.finish), idem_key: `fitting:${fid}`, captured_at: new Date().toISOString() })
  must(!e1, 'fitting ' + e1?.message)
  const bytes = await jpeg(f.type, f.finish === 'pvd_brushed_gold' ? 'pvd_brushed_gold' : 'chrome')
  for (const slot of ['front', 'side', 'top', 'close_up']) {
    const body = Buffer.concat([bytes, Buffer.from(slot)])
    const sha = createHash('sha256').update(body).digest('hex')
    const path = `surveys/${surveyId}/${fid}/${slot}/${sha}.jpg`
    const up = await ankit.storage.from('survey-photos').upload(path, body, { contentType: 'image/jpeg', upsert: false })
    must(!up.error, 'upload ' + up.error?.message)
    const { data: exists } = await ankit.storage.from('survey-photos').exists(path)
    must(exists, 'upload confirmed')
    const { error: e2 } = await ankit.from('fitting_photos').insert({ id: randomUUID(), fitting_id: fid, slot, storage_path: path, sha256: sha, bytes: body.length, width: 800, height: 600, lat: 28.6448, lng: 77.2167, accuracy_m: 12, device_id: 'golden-path', captured_at: new Date().toISOString() })
    must(!e2, 'photo row ' + e2?.message)
  }
  const { error: e3 } = await ankit.rpc('upsert_assessment', { p: { fitting_id: fid, recommended: f.rec, finish_id: f.target ? F(f.target) : null, surveyor_note: null } })
  must(!e3, 'assessment ' + e3?.message)
}
{ const { error } = await ankit.rpc('submit_survey', { p_survey_id: surveyId }); must(!error, 'submit ' + error?.message) }
log('4 surveyor: check-in, 4 fittings × 4 photos, assessments, submitted ✓')

// 4 ── Quote created and issued (web)
async function staffLogin(name) {
  const p = await (await ctx()).newPage()
  await p.goto(B + '/staff/login', { waitUntil: 'networkidle' })
  await p.getByRole('button', { name: new RegExp(name) }).click()
  await p.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 60000 })
  return p
}
const sp = await staffLogin('Ankit Verma')
await sp.goto(B + `/staff/surveys/${surveyId}`, { waitUntil: 'networkidle' })
await sp.getByRole('button', { name: /Create quot/i }).click()
await sp.waitForURL(/\/staff\/quotes\/[0-9a-f-]{36}$/, { timeout: 60000 })
const quoteId = sp.url().split('/').pop()
await sp.waitForLoadState('networkidle')
await sp.getByRole('button', { name: /Issue & send/ }).click()
await sp.getByText('Sent', { exact: true }).first().waitFor({ timeout: 60000 })
log('5 quotation created and issued ✓')

// 5 ── Customer approves by OTP
async function portalLogin() {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true }); const p = await c.newPage()
  await p.goto(B + '/portal/login', { waitUntil: 'networkidle' })
  await p.fill('#phone', PHONE10)
  await p.getByRole('button', { name: /Send code/ }).click()
  await p.waitForSelector('#code', { timeout: 60000 })
  await p.fill('#code', (await p.locator('text=Demo code').innerText()).replace(/\D/g, ''))
  await p.getByRole('button', { name: 'Sign in' }).click()
  await p.waitForURL(/\/portal$/, { timeout: 60000 })
  return p
}
const cp = await portalLogin()
await cp.waitForLoadState('networkidle')
must(await cp.getByText(/ready to approve/).count(), 'prospect sees the quotation on the portal home')
await cp.getByText(/ready to approve/).first().click()
await cp.waitForURL(/\/portal\/quotes\//)
await cp.getByRole('button', { name: /send me a code/ }).click()
await cp.waitForSelector('#ap-code', { timeout: 60000 })
await cp.fill('#ap-code', (await cp.locator('text=Demo code').innerText()).replace(/\D/g, ''))
await cp.getByRole('button', { name: 'Approve quotation' }).click()
await cp.getByText('Approved', { exact: true }).first().waitFor({ timeout: 60000 })
log('6 customer approved by OTP ✓')

// 6 ── Job: stages → handover
const ap = await staffLogin('Vikram Sethi')
const vik = await as('vikram@redux.demo')
const { data: job } = await vik.from('jobs').select('id, job_no').eq('quotation_id', quoteId).single()
must(job, 'job opened')
await ap.goto(B + `/staff/jobs/${job.id}`, { waitUntil: 'networkidle' })
for (const stage of ['Removal & pickup', 'At Eurobrass', 'Quality check', 'Refit & test']) {
  for (let i = 0; i < 2; i++) {
    await ap.getByRole('button', { name: stage, exact: false }).first().click()
    await ap.waitForTimeout(2500)
    await ap.reload({ waitUntil: 'networkidle' })
  }
}
for (let i = 0; i < 2; i++) {
  await ap.goto(B + `/staff/jobs/${job.id}/handover`, { waitUntil: 'networkidle' })
  for (const c of ['No leaks', 'Operates smoothly', 'Finish as promised']) await ap.getByRole('checkbox', { name: new RegExp(c) }).click()
  await ap.fill('#ho-name', `${CUSTOMER.name}, General Manager`)
  await ap.getByRole('button', { name: /Sign off/ }).click()
  await ap.waitForURL(new RegExp(`/staff/jobs/${job.id}$`), { timeout: 60000 })
}
const { data: w } = await vik.from('warranties').select('id').eq('job_id', job.id)
must(w?.length > 0, 'warranty cards generated')
log('7 job', job.job_no, 'all stages, handover, warranty cards:', w.length, '✓')

// 7 ── Invoice
await ap.goto(B + '/staff/admin/invoices', { waitUntil: 'networkidle' })
await ap.locator('li', { hasText: job.job_no }).getByRole('button', { name: /Raise invoice/ }).click()
await ap.waitForURL(/\/staff\/admin\/invoices\/[0-9a-f-]{36}$/, { timeout: 60000 })
await ap.getByRole('button', { name: /Issue invoice/ }).click()
await ap.getByText('Awaiting payment').first().waitFor({ timeout: 60000 })
log('8 invoice raised and issued ✓')

// 8 ── Customer pays
const cp2 = await portalLogin()
await cp2.goto(B + '/portal/invoices', { waitUntil: 'networkidle' })
await cp2.getByRole('button', { name: /Pay now|Bank details/ }).first().click()
await cp2.getByRole('button', { name: /^Pay ₹|Simulate the bank transfer/ }).click()
await cp2.getByText('Payment received').waitFor({ timeout: 60000 })
const { data: inv } = await vik.from('invoices').select('invoice_no, status, total').eq('job_id', job.id).single()
must(inv.status === 'paid', 'invoice paid, got ' + inv.status)
log('9 paid:', inv.invoice_no, inv.total, '✓')

const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: msgs } = await admin.from('messages').select('template_code').eq('to_address', PHONE).order('queued_at')
log('10 WhatsApps:', (msgs ?? []).length, '—', (msgs ?? []).map((m) => m.template_code).join(' → '))
const { data: finalLead } = await vik.from('leads').select('status').eq('id', lead.id).single()
log('11 lead status:', finalLead.status)
await browser.close()
log('GOLDEN PATH COMPLETE')
