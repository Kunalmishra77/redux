// UI audit of every page on the live demo, desktop + phone. For each page:
//  - HTTP status, error text, console errors
//  - page-level horizontal overflow (scrollWidth > viewport)
//  - elements that overflow their own box horizontally while their parent doesn't scroll
//    (the "cards spilling out of columns" class of bug) and text clipped without an ellipsis
//  - broken images, empty main headings
// Screenshots go to audit/<viewport>/<name>.png for a visual pass.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const B = process.env.BASE ?? 'https://redux-demo-iota.vercel.app'
const report = []

async function checks(page) {
  return page.evaluate(() => {
    const out = []
    const vw = document.documentElement.clientWidth
    if (document.documentElement.scrollWidth > vw + 1) out.push(`page scrolls sideways: ${document.documentElement.scrollWidth} > ${vw}`)
    const isScroller = (el) => { const s = getComputedStyle(el); return /(auto|scroll)/.test(s.overflowX) }
    const inScroller = (el) => { for (let p = el.parentElement; p; p = p.parentElement) if (isScroller(p)) return true; return false }
    const clippedByAncestor = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (/(hidden|clip)/.test(s.overflowX)) { const pr = p.getBoundingClientRect(); if (pr.right <= vw + 2) return true } } return false }
    const srOnly = (el) => { for (let p = el; p; p = p.parentElement) { const r = p.getBoundingClientRect(); if (r.width <= 1 || r.height <= 1 || String(p.className).includes('sr-only')) return true } return false }
    for (const el of document.querySelectorAll('main *, body > div *')) {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) continue
      const s = getComputedStyle(el)
      if (s.position === 'fixed' || s.visibility === 'hidden') continue
      // element sticking out of the viewport on the right, not inside a horizontal scroller
      if (r.right > vw + 2 && !inScroller(el) && !clippedByAncestor(el) && !el.closest('[data-radix-popper-content-wrapper]')) {
        out.push(`off-screen right: <${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 60)}"> ${Math.round(r.right)}px "${(el.textContent || '').trim().slice(0, 40)}"`)
      }
      // text overflowing its box without an ellipsis (clipped mid-word)
      if (el.children.length === 0 && el.scrollWidth > el.clientWidth + 2 && s.overflowX === 'hidden' && s.textOverflow !== 'ellipsis' && !srOnly(el)) {
        out.push(`clipped text: "${(el.textContent || '').trim().slice(0, 50)}"`)
      }
    }
    // interactive or text content cut off by the box that clips it (not decorative, not ellipsised)
    for (const el of document.querySelectorAll('main a, main button, main p, main span, main h1, main h2, main h3, main td, main th, main select, main input')) {
      if (el.closest('[aria-hidden="true"], .pointer-events-none, .sr-only, [data-radix-popper-content-wrapper]')) continue
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue
      if (getComputedStyle(el).textOverflow === 'ellipsis' || el.classList.contains('truncate')) continue
      for (let p = el.parentElement; p && p.tagName !== 'MAIN'; p = p.parentElement) {
        const ps = getComputedStyle(p)
        if (/(auto|scroll)/.test(ps.overflowX)) break
        if (/(hidden|clip)/.test(ps.overflowX)) {
          const pr = p.getBoundingClientRect()
          if (r.right > pr.right + 3 && r.left < pr.right) out.push(`cut off by its box: <${el.tagName.toLowerCase()}> "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40)}" (${Math.round(r.right)} > ${Math.round(pr.right)})`)
          break
        }
      }
    }
    for (const img of document.images) if (img.complete && img.naturalWidth === 0) out.push(`broken image: ${img.src.slice(0, 80)}`)
    const h1 = document.querySelector('h1')
    if (!h1 || !h1.textContent.trim()) out.push('no h1')
    return [...new Set(out)].slice(0, 8)
  })
}

async function audit(ctx, label, pages) {
  for (const vp of [{ n: 'desk', w: 1440, h: 900 }, { n: 'phone', w: 390, h: 844 }]) {
    mkdirSync(`audit/${vp.n}`, { recursive: true })
    const page = await ctx.newPage()
    await page.setViewportSize({ width: vp.w, height: vp.h })
    const errs = []
    page.on('console', (m) => { if (m.type() === 'error' && !/hydrat|caret-color|Failed to fetch RSC|favicon/i.test(m.text())) errs.push(m.text().slice(0, 120)) })
    page.on('pageerror', (e) => errs.push('pageerror ' + e.message.slice(0, 120)))
    for (const [path, name] of pages) {
      errs.length = 0
      let status = 0
      try {
        const r = await page.goto(B + path, { waitUntil: 'load', timeout: 90000 })
        status = r?.status() ?? 0
        await page.waitForTimeout(700)
      } catch (e) { report.push(`[${vp.n}] ${label} ${path} → NAV FAIL ${e.message.slice(0, 80)}`); continue }
      const body = await page.locator('body').innerText()
      const bad = /Application error|Unhandled Runtime Error|Internal Server Error|could not be found|NaN|undefined|\[object Object\]/.exec(body)
      const issues = await checks(page)
      if (bad) issues.unshift(`text contains "${bad[0]}"`)
      if (errs.length) issues.push(...errs.map((e) => 'console: ' + e))
      await page.screenshot({ path: `audit/${vp.n}/${label}-${name}.png`, fullPage: true })
      report.push(`[${vp.n}] ${status} ${label} ${path}${issues.length ? '\n     - ' + issues.join('\n     - ') : '  ✓'}`)
    }
    await page.close()
  }
}

async function staff(browser, who) {
  const ctx = await browser.newContext()
  const p = await ctx.newPage()
  await p.goto(B + '/staff/login', { waitUntil: 'load' })
  await p.getByRole('button', { name: new RegExp(who) }).click()
  await p.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 60000 })
  await p.close()
  return ctx
}
async function portal(browser, phone10) {
  const ctx = await browser.newContext({ isMobile: true })
  const p = await ctx.newPage()
  await p.goto(B + '/portal/login', { waitUntil: 'load' })
  await p.fill('#phone', phone10)
  await p.getByRole('button', { name: /Send code/ }).click()
  await p.waitForSelector('#code', { timeout: 60000 })
  await p.fill('#code', (await p.locator('text=Demo code').innerText()).replace(/\D/g, ''))
  await p.getByRole('button', { name: 'Sign in' }).click()
  await p.waitForURL(/\/portal$/, { timeout: 60000 })
  await p.close()
  return ctx
}
async function firstHref(ctx, path, prefix) {
  const p = await ctx.newPage(); await p.goto(B + path, { waitUntil: 'load' })
  const h = await p.locator(`a[href^="${prefix}"]`).evaluateAll((as, pre) => as.map((a) => a.getAttribute('href')).find((h) => h && h.length > pre.length + 30), prefix)
  await p.close(); return h
}

const browser = await chromium.launch()
const pub = await browser.newContext()
await audit(pub, 'web', [['/', 'home'], ['/hotels', 'hotels'], ['/register', 'register'], ['/r/LAKE631', 'ref-link'], ['/book-assessment', 'book'], ['/homes', 'homes-404']])

const LAKE = '3f6754af-d2d4-470f-bd98-10aab12ef1da', SA = 'af56d47b-3f57-4bfa-bc35-1f8ad78f5c62'
const admin = await staff(browser, 'Vikram Sethi')
const demo = await firstHref(admin, '/staff/demos', '/staff/demos/')
const camp = await firstHref(admin, '/staff/campaigns', '/staff/campaigns/')
const dJob = await firstHref(admin, '/staff/demos/76c8e10f-57f0-46a1-ab95-54a9b31c80df', '/staff/jobs/')
const reports = ['tiers', 'assessments', 'demos', 'people', 'accounts', 'referrals', 'campaigns', 'products'].map((t) => [`/staff/admin/reports?tab=${t}&days=365`, `rep-${t}`])
await audit(admin, 'admin', [['/staff/accounts', 'accounts'], [`/staff/accounts/${LAKE}`, 'acc'], [`/staff/accounts/${LAKE}?tab=timeline`, 'acc-tl'],
  [`/staff/accounts/${LAKE}?tab=work`, 'acc-work'], [`/staff/accounts/${LAKE}?tab=assessments`, 'acc-ass'], [`/staff/accounts/${LAKE}?tab=comms`, 'acc-comms'],
  ['/staff/surveys', 'surveys'], [`/staff/surveys/${SA}`, 'self-review'], ['/staff/demos', 'demos'], [demo, 'demo'], [dJob, 'demo-job'],
  ['/staff/referrals', 'referrals'], ['/staff/campaigns', 'campaigns'], ['/staff/campaigns/new', 'camp-new'], [camp, 'camp'],
  ['/staff/admin/scoring', 'scoring'], ['/staff/admin', 'admin'], ['/staff/leads', 'leads'], ['/staff', 'dash'], ...reports,
  [`/staff/reports/completion/${dJob.split('/').pop()}`, 'demo-report']])

const exec = await staff(browser, 'Priya Nair')
await audit(exec, 'exec', [['/staff/accounts', 'accounts'], ['/staff/demos', 'demos'], ['/staff/referrals', 'referrals'], ['/staff/campaigns', 'campaigns'], ['/staff/follow-ups', 'follow-ups']])

const kavita = await portal(browser, '9810011003')
await audit(kavita, 'kavita', [['/portal', 'home'], ['/portal/referrals', 'refer'], ['/portal/history', 'history'], ['/portal/history?tab=work', 'hist-work'], ['/portal/team', 'team']])
const maple = await portal(browser, '9810011028')
await audit(maple, 'maple', [['/portal', 'home'], [`/portal/self-assessment/${SA}`, 'self-assessment'], ['/portal/history?tab=assessments', 'hist-ass']])
const meenal = await portal(browser, '9811204595')
await audit(meenal, 'meenal', [['/portal', 'home']])

console.log(report.join(String.fromCharCode(10)))
await browser.close()
