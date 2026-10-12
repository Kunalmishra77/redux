// CR-001 golden path on the LIVE demo, in a real browser: a hotel arrives through a referral link,
// registers, does a self-assessment, gets a quote with the referral discount, has a free demo, approves
// (demo converts), the work is done, it pays (the referrer earns credit), and asks for the work again.
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { mkdirSync } from 'node:fs'

const B = process.env.BASE ?? 'https://redux-demo-iota.vercel.app'
const PHONE10 = process.env.GP_PHONE ?? '9811204611'
const PHONE = `+91${PHONE10}`
const HOTEL = process.env.GP_HOTEL ?? 'Hotel Saffron Court'
const CODE = 'LAKE631', LAKE = '3f6754af-d2d4-470f-bd98-10aab12ef1da'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)
const must = (cond, msg) => { if (!cond) throw new Error('ASSERT: ' + msg); }
mkdirSync('gp2', { recursive: true })
const browser = await chromium.launch()
const snap = (p, n) => p.screenshot({ path: `gp2/${n}.png`, fullPage: true })
const toast = (p, re) => p.locator('[data-sonner-toast]').filter({ hasText: re }).first().waitFor({ timeout: 60000 })

async function staff(name) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage()
  await p.goto(B + '/staff/login', { waitUntil: 'networkidle' })
  await p.getByRole('button', { name: new RegExp(name) }).click()
  await p.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 60000 })
  return p
}
async function customer() {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, isMobile: true })
  const p = await ctx.newPage()
  await p.goto(B + '/portal/login', { waitUntil: 'networkidle' })
  await p.fill('#phone', PHONE10)
  await p.getByRole('button', { name: /Send code/ }).click()
  await p.waitForSelector('#code', { timeout: 60000 })
  await p.fill('#code', (await p.locator('text=Demo code').innerText()).replace(/\D/g, ''))
  await p.getByRole('button', { name: 'Sign in' }).click()
  await p.waitForURL(/\/portal$/, { timeout: 60000 })
  return p
}

// 1 ── the referral link, then registration
const cp = await (await browser.newContext({ viewport: { width: 400, height: 860 }, isMobile: true })).newPage()
await cp.goto(`${B}/r/${CODE}`, { waitUntil: 'networkidle' })
must(cp.url().includes('/register'), 'link opens registration')
await cp.waitForFunction(() => document.querySelector('#reg-referredBy')?.value === 'LAKE631', null, { timeout: 15000 })
await cp.fill('#reg-businessName', HOTEL)
await cp.selectOption('#reg-segment', 'hotel')
await cp.fill('#reg-sizeUnits', '18')
await cp.selectOption('#reg-cityId', { label: 'Delhi' })
await cp.fill('#reg-pincode', '110055')
await cp.fill('#reg-contactName', 'Ritu Anand')
await cp.fill('#reg-roleTitle', 'General Manager')
await cp.fill('#reg-phone', PHONE10)
await cp.fill('#reg-email', 'ritu@saffroncourt.example')
await cp.locator('input[name="consentService"]').check()
await cp.locator('input[name="consentMarketing"]').check()
await cp.getByRole('button', { name: /Continue — verify my mobile/ }).click()
await cp.waitForSelector('#reg-code', { timeout: 60000 })
await cp.fill('#reg-code', (await cp.locator('text=Demo code').innerText()).replace(/\D/g, ''))
await cp.getByRole('button', { name: 'Create my account' }).click()
await cp.waitForURL(/\/portal\?welcome=1/, { timeout: 60000 })
await snap(cp, '01-welcome')
const { data: contact } = await admin.from('customer_contacts').select('customer_id').eq('phone', PHONE).single()
const ACC = contact.customer_id
const { data: lead } = await admin.from('leads').select('id, tier, assessment_mode, demo_offer').eq('customer_id', ACC).order('created_at', { ascending: false }).limit(1).single()
const { data: ref } = await admin.from('referrals').select('channel, referrer_customer_id').eq('referred_lead_id', lead.id).single()
must(ref.referrer_customer_id === LAKE, 'referral recorded to Lakeview')
log('1 registered through the link ✓ referral', ref.channel, '· tier', lead.tier, '·', lead.assessment_mode, '·', lead.demo_offer)
must(lead.tier === 'B' && lead.assessment_mode === 'self' && lead.demo_offer === 'fitting_demo', 'B tier near → self-assessment + fitting demo')

// 2 ── staff verify the account and send the self-assessment
const sp = await staff('Vikram Sethi')
await sp.goto(`${B}/staff/accounts/${ACC}`, { waitUntil: 'networkidle' })
await sp.getByRole('button', { name: /Verify account/ }).click()
await toast(sp, /verified/i)
await sp.goto(`${B}/staff/leads/${lead.id}`, { waitUntil: 'networkidle' })
must(await sp.getByText('Qualification').count(), 'qualification panel')
await sp.getByRole('button', { name: /Send self-assessment/ }).click()
await toast(sp, /Self-assessment link sent/)
const { data: sv } = await admin.from('surveys').select('id').eq('lead_id', lead.id).neq('mode', 'onsite').single()
log('2 account verified, self-assessment sent ✓')

// 3 ── customer does the self-assessment on the phone
const pp = await customer()
await pp.getByText(/Continue your self-assessment/).first().click()
await pp.waitForURL(/\/portal\/self-assessment\//)
await pp.locator('#fx-unit').waitFor({ timeout: 30000 })
await pp.fill('#fx-unit', '101')
await pp.getByRole('button', { name: 'Basin mixer', exact: true }).click()
await pp.selectOption('#fx-finish', { label: 'Chrome' })
await pp.getByRole('button', { name: 'Worn finish' }).click()
await pp.getByRole('button', { name: 'Add fitting' }).click()
await toast(pp, /Added/)
await pp.waitForTimeout(1500)
for (let i = 0; i < 4; i++) {
  const input = pp.locator('input[type="file"]').nth(i)
  await input.setInputFiles(new URL(`./jpg/p${i}.jpg`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))
  await pp.waitForFunction((n) => document.querySelectorAll('img[alt*="Basin mixer"]').length >= n, i + 1, { timeout: 60000 })
}
await snap(pp, '03-wizard')
await pp.getByRole('button', { name: /Send to REDUX/ }).click()
await pp.getByRole('button', { name: 'Send', exact: true }).click()
await toast(pp, /Sent to REDUX/)
log('3 self-assessment: 1 fitting, 4 photos, submitted ✓')

// 4 ── staff price it → quotation with the referral 5% → send
await sp.goto(`${B}/staff/surveys/${sv.id}`, { waitUntil: 'networkidle' })
await sp.getByRole('button', { name: 'Price it' }).click()
await toast(sp, /Priced/)
await sp.reload({ waitUntil: 'networkidle' })
await sp.getByRole('button', { name: /Create quot/i }).click()
await sp.waitForURL(/\/staff\/quotes\/[0-9a-f-]{36}$/, { timeout: 60000 })
const quoteId = sp.url().split('/').pop()
must(await sp.getByText(/First order of a referred business/).count(), 'referral note on the quote')
const { data: q1 } = await admin.from('quotations').select('quote_no, discount_pct, total').eq('id', quoteId).single()
must(Number(q1.discount_pct) === 5, 'referral 5% applied')
await snap(sp, '04-quote')
await sp.getByRole('button', { name: /Issue & send/ }).click()
await sp.getByText(/Sent|sent to the customer/i).first().waitFor({ timeout: 60000 })
log('4 priced, quoted', q1.quote_no, '5% referral, sent ✓ total', q1.total)

// 5 ── free single-fitting demo: propose → approve → schedule → run → done
await sp.goto(`${B}/staff/leads/${lead.id}`, { waitUntil: 'networkidle' })
await sp.getByRole('button', { name: /Propose demo/ }).click()
await sp.getByRole('checkbox').first().check()
await sp.getByRole('button', { name: /Send for approval/ }).click()
await sp.waitForURL(/\/staff\/demos\/[0-9a-f-]{36}$/, { timeout: 60000 })
const demoId = sp.url().split('/').pop()
await sp.getByRole('button', { name: 'Approve' }).click()
await toast(sp, /Approved/)
await sp.reload({ waitUntil: 'networkidle' })
await sp.fill('#demo-date', new Date(Date.now() + 864e5).toISOString().slice(0, 10))
await sp.getByRole('button', { name: 'Schedule' }).click()
await toast(sp, /Scheduled/)
const { data: d1 } = await admin.from('demos').select('job_id, demo_no').eq('id', demoId).single()
async function runJob(jobId) {
  await sp.goto(`${B}/staff/jobs/${jobId}`, { waitUntil: 'networkidle' })
  for (const stage of ['Removal & pickup', 'At Eurobrass', 'Quality check', 'Refit & test']) {
    await sp.getByRole('button', { name: stage, exact: false }).first().click()
    await sp.waitForTimeout(2500)
    await sp.reload({ waitUntil: 'networkidle' })
  }
  await sp.goto(`${B}/staff/jobs/${jobId}/handover`, { waitUntil: 'networkidle' })
  for (const c of ['No leaks', 'Operates smoothly', 'Finish as promised']) await sp.getByRole('checkbox', { name: new RegExp(c) }).click()
  await sp.fill('#ho-name', 'Ritu Anand, General Manager')
  await sp.getByRole('button', { name: /Sign off/ }).click()
  await sp.waitForURL(new RegExp(`/staff/jobs/${jobId}$`), { timeout: 60000 })
}
await runJob(d1.job_id)
await sp.goto(`${B}/staff/demos/${demoId}`, { waitUntil: 'networkidle' })
await sp.selectOption('#demo-result', 'pass')
await sp.fill('#demo-cost', '1800')
await sp.fill('#demo-fb', 'GM compared the restored mixer with a new one — could not tell.')
await sp.getByRole('button', { name: 'Save' }).click()
await toast(sp, /Saved/)
const { data: d2 } = await admin.from('demos').select('status, internal_cost').eq('id', demoId).single()
must(d2.status === 'completed', 'demo completed, got ' + d2.status)
log('5 demo', d1.demo_no, 'approved, scheduled, done, cost ₹', d2.internal_cost, '✓')

// 6 ── customer approves the quotation → demo converts, referral converts
await pp.goto(`${B}/portal`, { waitUntil: 'networkidle' })
await pp.getByText(/ready to approve/).first().click()
await pp.waitForURL(/\/portal\/quotes\//)
await pp.getByRole('button', { name: /send me a code/ }).click()
await pp.waitForSelector('#ap-code', { timeout: 60000 })
await pp.fill('#ap-code', (await pp.locator('text=Demo code').innerText()).replace(/\D/g, ''))
await pp.getByRole('button', { name: 'Approve quotation' }).click()
await pp.getByText('Approved', { exact: true }).first().waitFor({ timeout: 60000 })
const { data: d3 } = await admin.from('demos').select('status').eq('id', demoId).single()
const { data: r2 } = await admin.from('referrals').select('status').eq('referred_lead_id', lead.id).single()
must(d3.status === 'converted' && r2.status === 'converted', `demo ${d3.status}, referral ${r2.status}`)
log('6 approved by OTP → demo converted, referral converted ✓')

// 7 ── the work, the invoice, the payment → the referrer's credit
const { data: job } = await admin.from('jobs').select('id, job_no').eq('quotation_id', quoteId).single()
await runJob(job.id)
await sp.goto(B + '/staff/admin/invoices', { waitUntil: 'networkidle' })
await sp.locator('li', { hasText: job.job_no }).getByRole('button', { name: /Raise invoice/ }).click()
await sp.waitForURL(/\/staff\/admin\/invoices\/[0-9a-f-]{36}$/, { timeout: 60000 })
await sp.getByRole('button', { name: /Issue invoice/ }).click()
await sp.getByText('Awaiting payment').first().waitFor({ timeout: 60000 })
await pp.goto(B + '/portal/invoices', { waitUntil: 'networkidle' })
await pp.getByRole('button', { name: /Pay now|Bank details/ }).first().click()
await pp.getByRole('button', { name: /^Pay ₹|Simulate the bank transfer/ }).click()
await pp.getByText('Payment received').waitFor({ timeout: 60000 })
const { data: credit } = await admin.from('rewards').select('amount').eq('customer_id', LAKE).eq('kind', 'credit').order('issued_at', { ascending: false }).limit(1).maybeSingle()
const { data: r3 } = await admin.from('referrals').select('status, first_order_value').eq('referred_lead_id', lead.id).single()
must(r3.status === 'rewarded' && credit, 'referrer credited')
log('7 job', job.job_no, 'done, invoiced, paid → Lakeview credit ₹', credit.amount, '(5% of', r3.first_order_value + ') ✓')

// 8 ── "Request again"
await pp.goto(B + '/portal/history?tab=work', { waitUntil: 'networkidle' })
await pp.getByRole('button', { name: /Request again/ }).first().click()
await pp.locator('textarea').first().fill('Same again for rooms 102–110 before Diwali.')
await pp.getByRole('button', { name: /Send|Request/ }).last().click()
await toast(pp, /./)
await pp.waitForTimeout(2000)
const { data: leads2 } = await admin.from('leads').select('id, status, raw_payload').eq('customer_id', ACC).order('created_at', { ascending: false })
must(leads2.length >= 2 && leads2[0].raw_payload?.form === 'repeat_request', 'repeat request became a new enquiry on the account')
await snap(pp, '08-history')
log('8 repeat request → new enquiry on the account ✓')

// 9 ── what the referrer sees
const kp = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
await kp.goto(B + '/portal/login', { waitUntil: 'networkidle' })
await kp.fill('#phone', '9810011003')
await kp.getByRole('button', { name: /Send code/ }).click()
await kp.waitForSelector('#code', { timeout: 60000 })
await kp.fill('#code', (await kp.locator('text=Demo code').innerText()).replace(/\D/g, ''))
await kp.getByRole('button', { name: 'Sign in' }).click()
await kp.waitForURL(/\/portal$/, { timeout: 60000 })
await kp.goto(B + '/portal/referrals', { waitUntil: 'networkidle' })
must(await kp.getByText(HOTEL).count(), 'referrer sees the new business')
await snap(kp, '09-referrer')
const { data: msgs } = await admin.from('messages').select('template_code').eq('to_address', PHONE).order('queued_at')
log('9 referrer portal shows it ✓ · WhatsApps to the customer:', (msgs ?? []).map((m) => m.template_code).join(' → '))
await browser.close()
log('CR-001 GOLDEN PATH COMPLETE')
