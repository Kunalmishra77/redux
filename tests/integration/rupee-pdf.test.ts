import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatInr } from '@/lib/services/money'

// CI gate 7 (QA plan §2) / ADR-010: ₹ renders in a Gotenberg PDF, with Indian digit grouping.
// Needs a running Gotenberg built from docker/gotenberg/Dockerfile, and poppler-utils
// (pdftotext, pdffonts). CI provides both; without GOTENBERG_URL the test is skipped.
const gotenbergUrl = process.env.GOTENBERG_URL

describe.skipIf(!gotenbergUrl)('₹ renders in a Gotenberg PDF', () => {
  it('embeds Noto Sans and extracts ₹1,23,456 intact', async () => {
    const amount = formatInr('123456')
    const html = `<!doctype html><html><head><meta charset="utf-8">
      <style>body { font-family: 'Noto Sans', sans-serif; font-size: 24px; }</style>
      </head><body><p>Total incl. GST: ${amount}</p></body></html>`

    const form = new FormData()
    form.append('files', new Blob([html], { type: 'text/html' }), 'index.html')
    const res = await fetch(`${gotenbergUrl}/forms/chromium/convert/html`, {
      method: 'POST',
      body: form,
    })
    expect(res.status).toBe(200)

    const dir = mkdtempSync(join(tmpdir(), 'rupee-'))
    const pdfPath = join(dir, 'rupee.pdf')
    writeFileSync(pdfPath, Buffer.from(await res.arrayBuffer()))

    const text = execFileSync('pdftotext', ['-enc', 'UTF-8', pdfPath, '-'], { encoding: 'utf8' })
    expect(text).toContain('₹1,23,456')

    // A fallback font could also carry ₹; asserting Noto Sans proves the baked-in font is used.
    const fonts = execFileSync('pdffonts', [pdfPath], { encoding: 'utf8' })
    expect(fonts).toMatch(/NotoSans/)
  }, 30_000)
})
